import { getTelegramFile, getTelegramFileDownloadUrl } from "./telegram";

/**
 * Downloads a Telegram file attachment (photo or voice note) into a Base64 string buffer
 */
export async function downloadTelegramFileAsBase64(fileId: string): Promise<{
  base64Data: string;
  mimeType: string;
} | null> {
  try {
    const fileInfo = await getTelegramFile(fileId);
    if (!fileInfo || !fileInfo.file_path) {
      console.error("Could not retrieve file path for file_id:", fileId);
      return null;
    }

    const downloadUrl = getTelegramFileDownloadUrl(fileInfo.file_path);
    const res = await fetch(downloadUrl);
    if (!res.ok) {
      console.error("Failed to download file from Telegram CDN:", res.statusText);
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString("base64");

    // Infer MIME type from file extension
    const ext = fileInfo.file_path.split(".").pop()?.toLowerCase() || "";
    let mimeType = "image/jpeg";
    if (ext === "png") mimeType = "image/png";
    else if (ext === "webp") mimeType = "image/webp";
    else if (ext === "oga" || ext === "ogg") mimeType = "audio/ogg";
    else if (ext === "mp3") mimeType = "audio/mp3";
    else if (ext === "m4a") mimeType = "audio/m4a";

    return { base64Data, mimeType };
  } catch (error) {
    console.error("Error downloading Telegram media:", error);
    return null;
  }
}
