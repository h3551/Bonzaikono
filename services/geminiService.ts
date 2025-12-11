import { GoogleGenAI } from "@google/genai";
import { TreeData, GrowthStage } from "../types";

// Helper to safely get the API key
const getApiKey = (): string | undefined => {
  return process.env.API_KEY;
};

export const getMasterGardenerAdvice = async (tree: TreeData): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    return "The spirits are silent. (API Key missing)";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    let context = `
      You are a wise, ancient Bonsai Master. 
      The user is growing a ${tree.species} tree.
      It is currently in the ${GrowthStage[tree.stage]} stage.
      Age: ${tree.age} days.
      Water Level: ${tree.water}/100.
      Fertilizer Level: ${tree.fertilizer}/100.
      Health: ${tree.health}/100.
    `;

    if (tree.water < 20) context += " The soil is parched.";
    if (tree.fertilizer < 20) context += " The tree is starving for nutrients.";
    if (tree.health < 50) context += " The tree looks weak.";

    const prompt = `
      ${context}
      Give a short, poetic, yet practical piece of advice (max 2 sentences) about what the user should do next or a philosophical thought on the tree's state. 
      Speak in a calm, Zen-like manner.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text.trim();
  } catch (error) {
    console.error("Gemini Error:", error);
    return "The wind drowns out the master's voice. Try again later.";
  }
};
