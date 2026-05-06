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
      model: "gemini-3-flash-preview",
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
  } catch (error) {
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
    random_shirt: `A professional 2x2 passport-style portrait. Change the shirt to a neatly pressed ${color || "random professional colored"} shirt. ABSOLUTELY PRESERVE THE ORIGINAL FACE, FEATURES, AND IDENTITY EXACTLY. BOTH EARS MUST BE FULLY VISIBLE AND UNCOVERED. If ears are covered, hair must be moved back and ears realistically synthesized or placed appropriately for the face. Pure white background.`,
    tshirt: `A professional 2x2 portrait wearing a clean, solid-colored T-shirt in ${color || "a random professional color"}. ABSOLUTELY PRESERVE THE ORIGINAL FACE AND IDENTITY. BOTH EARS MUST BE FULLY VISIBLE AND UNCOVERED. Synthesize/draw realistic ears if they are covered by hair or headwear. Pure white background.`,
    suit: `A high-quality professional 2x2 passport-style portrait wearing a formal dark suit jacket (coat), a crisp shirt in ${color || "white"}, and a professional tie. ABSOLUTELY PRESERVE THE ORIGINAL FACE AND IDENTITY. BOTH EARS MUST BE FULLY VISIBLE AND UNCOVERED. Synthesize realistic ears if they are not visible. Pure white background.`,
    female_dress: `A professional 2x2 passport-style portrait of an adult woman wearing a formal elegant Kameez (traditional professional dress) in ${color || "a random professional color"}. ABSOLUTELY PRESERVE THE ORIGINAL FACE AND IDENTITY. BOTH EARS MUST BE FULLY VISIBLE AND UNCOVERED. If ears are covered by hair or clothing, the AI must realistically place/synthesize uncovered ears based on the face shape. Pure white background.`,
    female_suit: `A professional 2x2 passport-style portrait of a woman wearing a traditional three-piece formal outfit (Salwar Kameez style) consisting of an elegant Kameez and a matching scarf (Dupatta) in ${color || "a random elegant color"}. ABSOLUTELY PRESERVE THE ORIGINAL FACE AND IDENTITY. BOTH EARS MUST BE FULLY VISIBLE. The scarf must NOT cover the ears; realistically synthesize ears if they are hidden. Pure white background.`,
    female_blouse: `A professional 2x2 passport-style portrait of a woman wearing a formal professional blouse in ${color || "a random elegant color"}. ABSOLUTELY PRESERVE THE ORIGINAL FACE AND IDENTITY. BOTH EARS MUST BE FULLY VISIBLE and uncovered. Synthesize ears if necessary. Pure white background.`,
    female_saree: `A high-quality professional 2x2 portrait of a woman wearing a traditional elegant Saree in ${color || "a random beautiful color"}. ABSOLUTELY PRESERVE THE ORIGINAL FACE AND IDENTITY. BOTH EARS MUST BE FULLY VISIBLE. Synthesize realistic ears if they are covered. Pure white background.`,
    enhance: `A hyper-realistic, ultra-high resolution enhancement. Improve skin texture and sharpen eyes. PRESERVE THE ORIGINAL FACE EXACTLY. ENSURE BOTH EARS ARE FULLY VISIBLE AND UNCOVERED. If ears are missing or covered, realistically synthesize and place them according to the head shape. Pure white background.`,
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
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error: any) {
    if (error?.message?.includes("429") || error?.message?.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("API Quota Exceeded: You've reached the rate limit for image generation. Please wait a minute and try again.");
    }
    console.error("Image editing failed:", error);
    return null;
  }
}
