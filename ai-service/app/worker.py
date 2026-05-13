import os
import json
import time
import logging
import redis
import requests
from app.services.document_services import process_document

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Environment variables
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:5000") # We need to ensure this is set
QUEUE_NAME = "ocr_queue"

def run_worker():
    logging.info(f"Starting OCR Worker. Connecting to Redis at {REDIS_HOST}:{REDIS_PORT}")
    
    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0)
    
    while True:
        try:
            # BRPOP blocks until an item is available
            # Returns tuple (queue_name, data)
            _, data = r.brpop(QUEUE_NAME)
            
            job = json.loads(data)
            activity_id = job.get("activityId")
            file_path = job.get("filePath")
            language = job.get("language", "en")
            
            logging.info(f"Processing job for Activity {activity_id}: {file_path}")
            
            # Check for cancellation before starting
            if r.exists(f"cancel:{activity_id}"):
                logging.info(f"Job {activity_id} was cancelled before starting. Skipping.")
                r.delete(f"cancel:{activity_id}")
                if os.path.exists(file_path):
                    os.remove(file_path)
                continue

            # Process the document
            try:
                def cancel_check():
                    return r.exists(f"cancel:{activity_id}")

                result = process_document(file_path, cancel_check=cancel_check)
                
                # Double check after processing
                if cancel_check():
                    logging.info(f"Job {activity_id} was cancelled. Discarding results.")
                    r.delete(f"cancel:{activity_id}")
                    if os.path.exists(file_path):
                        os.remove(file_path)
                    continue

                logging.info(f"OCR Complete for Activity {activity_id}")
                
                # Update backend with results
                update_backend(activity_id, {
                    "status": "success",
                    "metadata": {
                        "documentData": result,
                        "language": language
                    }
                })
                
                # Clean up the file (Commented out: Let backend handle archiving/cleanup)
                # if os.path.exists(file_path):
                #     os.remove(file_path)
                #     logging.info(f"Deleted processed file: {file_path}")
                    
            except Exception as e:
                logging.exception(f"Error processing document {activity_id}")
                update_backend(activity_id, {"status": "failed", "error": str(e)})

        except Exception as e:
            logging.error(f"Worker loop error: {str(e)}")
            time.sleep(5) # Prevent tight loop on Redis error

def update_backend(activity_id, payload):
    try:
        url = f"{BACKEND_URL}/api/activities/{activity_id}/status"
        response = requests.put(url, json=payload)
        if response.status_code != 200:
            logging.error(f"Failed to update backend for activity {activity_id}: {response.text}")
    except Exception as e:
        logging.error(f"Error calling backend callback: {str(e)}")

if __name__ == "__main__":
    run_worker()
