import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export type OutfitType = 
  | "random_shirt" 
  | "tshirt" 
  | "suit" 
  | "enhance" 
  | "female_dress" 
  | "female_suit"
  | "female_blouse"
  | "female_saree";

export interface DetectionResult {
  box: BoundingBox;
  earsVisible: boolean;
}

export async function detectFace(base64Image: string, mimeType: string): Promise<DetectionResult | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: base64Image.split(",")[1],
                mimeType: mimeType,
              },
            },
            {
              text: "Find the primary face in this image. Return the bounding box coordinates [ymin, xmin, ymax, xmax] as a JSON object where values are 0-1000. Also, check if BOTH ears are clearly visible and uncovered. Return 'earsVisible' as a boolean. Use extreme precision.",
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ymin: { type: Type.NUMBER },
            xmin: { type: Type.NUMBER },
            ymax: { type: Type.NUMBER },
            xmax: { type: Type.NUMBER },
            earsVisible: { type: Type.BOOLEAN },
          },
          required: ["ymin", "xmin", "ymax", "xmax", "earsVisible"],
        },
      },
    });

    const result = JSON.parse(response.text);
    return {
      box: {
        ymin: result.ymin,
        xmin: result.xmin,
        ymax: result.ymax,
        xmax: result.xmax,
      },
      earsVisible: result.earsVisible,
    };
  } catch (error: any) {
    if (error?.message?.includes("403") || error?.message?.includes("PERMISSION_DENIED")) {
      throw new Error("API Permission Denied: Your API key doesn't have permission for this operation. Ensure you're in a supported region.");
    }
    if (error?.message?.includes("429") || error?.message?.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("API Quota Exceeded: You've reached the rate limit. Please wait a minute and try again.");
    }
    console.error("Face detection failed:", error);
    return null;
  }
}

export async function editPortrait(
  base64Image: string,
  mimeType: string,
  outfit: OutfitType,
  color?: string
): Promise<string | null> {
  const prompts: Record<OutfitType, string> = {
    random_shirt: `A professional passport-style portrait. Change the shirt to a neatly pressed ${color || "random professional colored"} shirt. MAINTAIN THE EXACT CROP AND ZOOM LEVEL OF THE INPUT IMAGE. CRITICAL: The image MUST reach the very edges of the canvas. DO NOT add any white borders, frames, margins, or photo shadows. PRESERVE THE ORIGINAL FACE EXACTLY. Pure white background.`,
    tshirt: `A professional portrait wearing a clean, solid-colored T-shirt in ${color || "a random professional color"}. MAINTAIN THE EXACT CROP AND ZOOM LEVEL OF THE INPUT IMAGE. CRITICAL: The image MUST reach the very edges of the canvas. DO NOT add any white borders, frames, margins, or photo shadows. PRESERVE THE ORIGINAL FACE EXACTLY. Pure white background.`,
    suit: `A professional passport-style portrait wearing a formal dark suit jacket (coat) and a crisp shirt in ${color || "white"}. MAINTAIN THE EXACT CROP AND ZOOM LEVEL OF THE INPUT IMAGE. CRITICAL: The image MUST reach the very edges of the canvas. DO NOT add any white borders, frames, margins, or photo shadows. PRESERVE THE ORIGINAL FACE EXACTLY. Pure white background.`,
    female_dress: `A professional passport-style portrait wearing a formal elegant Kameez in ${color || "a random professional color"}. MAINTAIN THE EXACT CROP AND ZOOM LEVEL OF THE INPUT IMAGE. CRITICAL: The image MUST reach the very edges of the canvas. DO NOT add any white borders, frames, margins, or photo shadows. PRESERVE THE ORIGINAL FACE EXACTLY. Pure white background.`,
    female_suit: `A professional portrait wearing a traditional three-piece formal outfit (Salwar Kameez style) in ${color || "a random elegant color"}. MAINTAIN THE EXACT CROP AND ZOOM LEVEL OF THE INPUT IMAGE. CRITICAL: The image MUST reach the very edges of the canvas. DO NOT add any white borders, frames, margins, or photo shadows. PRESERVE THE ORIGINAL FACE EXACTLY. Pure white background.`,
    female_blouse: `A professional passport-style portrait wearing a formal professional blouse in ${color || "a random elegant color"}. MAINTAIN THE EXACT CROP AND ZOOM LEVEL OF THE INPUT IMAGE. CRITICAL: The image MUST reach the very edges of the canvas. DO NOT add any white borders, frames, margins, or photo shadows. PRESERVE THE ORIGINAL FACE EXACTLY. Pure white background.`,
    female_saree: `A high-quality professional portrait wearing a traditional elegant Saree in ${color || "a random beautiful color"}. MAINTAIN THE EXACT CROP AND ZOOM LEVEL OF THE INPUT IMAGE. CRITICAL: The image MUST reach the very edges of the canvas. DO NOT add any white borders, frames, margins, or photo shadows. PRESERVE THE ORIGINAL FACE EXACTLY. Pure white background.`,
    enhance: `Subtly denoise and improve lighting. CRITICAL: The image MUST reach the very edges of the canvas. DO NOT add any white borders, frames, margins, or photo shadows. MUST NOT modify or change the facial structure, identity, or expression AT ALL. Face must remain 100% untouched and identical to input. Pure white background.`,
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image.split(",")[1],
              mimeType: mimeType,
            },
          },
          {
            text: prompts[outfit],
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/jpeg;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error: any) {
    if (error?.message?.includes("403") || error?.message?.includes("PERMISSION_DENIED")) {
      throw new Error("API Permission Denied: Your API key doesn't have permission for this operation. Image editing might be restricted in your region.");
    }
    if (error?.message?.includes("429") || error?.message?.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("API Quota Exceeded: You've reached the rate limit for image generation. Please wait a minute and try again.");
    }
    console.error("Image editing failed:", error);
    return null;
  }
}
