import { useState } from "react"
import UploadBox from "../components/UploadBox"
import ResultBox from "../components/ResultBox"

function Home(){

const [result,setResult] = useState(null)
const [processedFile, setProcessedFile] = useState(null)

return(

<main className="pageShell">

<section className="card">

<h1 className="cardTitle">OCR Document Extractor</h1>
<p className="cardSubtitle">Upload a PDF, extract text, tables, and embedded images, then download the output in Word format.</p>

<UploadBox setResult={setResult} setProcessedFile={setProcessedFile}/>

<ResultBox result={result} processedFile={processedFile}/>

</section>

</main>

)

}

export default Home
