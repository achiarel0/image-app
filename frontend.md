# Developer Spec: AI Image Synthesis App

## 1. Overview
Build a single-page frontend application that allows users to upload two images, sends them to a webhook, and displays the single generated image returned by the server. 

## 2. Tech Stack Requirements
* **Framework:** [Insert your preference, e.g., React, Next.js, or Vanilla JS/HTML]
* **Styling:** [Insert your preference, e.g., Tailwind CSS]
* **HTTP Client:** Native `fetch` API

## 3. State Management
The application must track the following state variables:
* `image1` (File object | null): The first uploaded image (e.g., person).
* `image2` (File object | null): The second uploaded image (e.g., clothing).
* `isLoading` (boolean): Tracks if the webhook request is in progress.
* `resultImage` (string | null): The Object URL of the binary image returned by the webhook.
* `errorMessage` (string | null): Holds any error text.

## 4. UI Components
1. **Input 1 (`image1`)**: File upload input restricted to `.jpg, .jpeg, .webp`. 
2. **Input 2 (`image2`)**: File upload input restricted to `.jpg, .jpeg, .webp`.
3. **Generate Button**: 
   * Disabled if `image1` or `image2` is null, or if `isLoading` is true.
   * On click, triggers the `generateImage()` function.
4. **Loading State**: A spinner or text indicating "Processing..." displayed when `isLoading` is true.
5. **Output Area**: 
   * An `<img>` tag that displays `resultImage` once populated.
   * Should be hidden if `resultImage` is null.

## 5. API Integration Details
**Function:** `generateImage()`
* **Endpoint:** `https://achiarel.app.n8n.cloud/webhook/2eaf85ec-55da-457e-a597-48814aa71dc3`
* **Method:** `POST`
* **Request Body:** `FormData`
  * Append `image1` (the actual File object)
  * Append `image2` (the actual File object)
* **Response Handling:** 
  * The webhook returns a raw binary file (image).
  * Parse the response as a Blob: `const blob = await response.blob();`
  * Convert to an Object URL: `const imageUrl = URL.createObjectURL(blob);`
  * Set `resultImage` to `imageUrl`.

## 6. Error Handling
* Wrap the API call in a `try/catch` block.
* If the API returns a non-200 status, or the fetch fails, set `errorMessage` to "Failed to generate image. Please try again." and display this to the user.
* Ensure `isLoading` is set to `false` in a `finally` block regardless of success or failure.

## 7. Execution Instructions for AI Agent
1. Scaffold the basic UI layout based on the components listed above.
2. Implement the state variables.
3. Write the file input handlers to capture the File objects.
4. Write the `generateImage` network request using the exact endpoint, FormData structure, and Blob handling specified.
5. Apply clean, modern styling (matching standard web practices).