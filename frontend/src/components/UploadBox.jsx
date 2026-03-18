import { useState } from "react"
import { uploadFile } from "../services/api"

function UploadBox({setResult, setProcessedFile, setIsLoading}){

const [file,setFile] = useState(null)
const [error,setError] = useState("")
const [isUploading,setIsUploading] = useState(false)

const handleUpload = async () => {
if (!file) {
setError("Please choose a PDF file first.")
return
}

if (!file.name.toLowerCase().endsWith(".pdf")) {
setError("Only PDF files are supported.")
return
}

const formData = new FormData()

formData.append("file",file)

try {
setIsUploading(true)
if (setIsLoading) setIsLoading(true)
setError("")
setResult(null)
const res = await uploadFile(formData)
setResult(res.data)
setProcessedFile(file)
} catch (err) {
const apiError = err?.response?.data?.error || err?.response?.data?.detail
setError(apiError || "Upload failed. Please try again.")
setResult(null)
setProcessedFile(null)
} finally {
setIsUploading(false)
if (setIsLoading) setIsLoading(false)
}

}

return(

<div className="uploadBox">

<label className="fileLabel">Choose PDF file</label>

<input type="file"
className="fileInput"
accept=".pdf,application/pdf"
onChange={(e)=>setFile(e.target.files[0])}
/>

<div className="uploadActionRow">

<button onClick={handleUpload}
className="primaryBtn"
disabled={isUploading}
>
{isUploading ? "Processing..." : "Upload"}
</button>

{file && <p className="fileName">{file.name}</p>}

</div>

{isUploading && <p className="fileName">Your PDF is uploaded. We are extracting text and tables now.</p>}

{error && <p className="errorText">{error}</p>}

</div>

)

}

export default UploadBox
