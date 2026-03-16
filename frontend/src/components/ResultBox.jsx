import { useState } from "react"
import { downloadWordFile } from "../services/api"

function ResultBox({result, processedFile}){

const [isDownloading, setIsDownloading] = useState(false)
const [downloadError, setDownloadError] = useState("")

if(!result) return null

const payload = result?.data || result

const extractedImages = Array.isArray(payload?.images) ? payload.images : []

const previewPayload = {
...payload,
images: extractedImages.map((image) => {
const { data_url, ...rest } = image || {}
return rest
})
}

const getFileNameFromDisposition = (contentDisposition) => {
if (!contentDisposition) return null
const match = contentDisposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i)
return match ? decodeURIComponent(match[1].replace(/"/g, "")) : null
}

const handleDownload = async () => {
if (!processedFile) {
setDownloadError("Upload a PDF first, then download the Word file.")
return
}

try {
setIsDownloading(true)
setDownloadError("")

const formData = new FormData()
formData.append("file", processedFile)

const response = await downloadWordFile(formData)

const contentType = response.headers["content-type"] || "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
const disposition = response.headers["content-disposition"]
const downloadedName = getFileNameFromDisposition(disposition)
const fallbackName = `${processedFile.name.replace(/\.pdf$/i, "") || "document"}.docx`

const blob = new Blob([response.data], { type: contentType })
const url = window.URL.createObjectURL(blob)
const link = document.createElement("a")
link.href = url
link.download = downloadedName || fallbackName
document.body.appendChild(link)
link.click()
document.body.removeChild(link)
window.URL.revokeObjectURL(url)
} catch (error) {
const apiError = error?.response?.data?.error
setDownloadError(apiError || "Word download failed. Please try again.")
} finally {
setIsDownloading(false)
}
}

return(

<div className="result">

<div className="resultHeader">
<h3>OCR Result</h3>

<button onClick={handleDownload}
disabled={isDownloading}
>
{isDownloading ? "Preparing..." : "Download Word"}
</button>
</div>

<div className="imageSection">
<h4>Extracted Images ({extractedImages.length})</h4>

{extractedImages.length === 0 && (
<p className="fileName">No embedded images were found in this PDF.</p>
)}

{extractedImages.length > 0 && (
<div className="imageGrid">
{extractedImages.map((image, index) => (
<div
className="imageCard"
key={`${image?.page_number || "page"}-${image?.image_index || index}-${image?.xref || "xref"}`}
>
{image?.data_url ? (
<img src={image.data_url}
alt={`Extracted image ${index + 1}`}
className="extractedImage"
loading="lazy"
/>
) : (
<div className="imageUnavailable">
Preview unavailable (image too large)
</div>
)}

<p className="imageMeta">
Page {image?.page_number || "?"} | {image?.width || "?"}x{image?.height || "?"} | {image?.extension || "unknown"}
</p>
</div>
))}
</div>
)}
</div>

<pre className="resultPreview">

{JSON.stringify(previewPayload,null,2)}

</pre>

{downloadError && <p className="errorText">{downloadError}</p>}

</div>

)

}

export default ResultBox
