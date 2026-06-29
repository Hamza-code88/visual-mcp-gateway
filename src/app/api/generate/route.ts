import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { executeQuery } from '@/lib/neo4j';
import { pushContentToStoryblok } from '@/lib/storyblok';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request: Request) {
  try {
    const { businessContext } = await request.json();

    // 1. Fetch deep context from Neo4j GraphRAG
    // This finds keywords competitors rank for, but the user does not.
    const graphData = await executeQuery(
      `MATCH (c:Competitor)-[:RANKS_FOR]->(k:Keyword)
       WHERE NOT (:User {id: $userId})-[:RANKS_FOR]->(k)
       RETURN k.term AS keyword LIMIT 5`,
      { userId: businessContext.userId }
    );
    
    const targetKeywords = graphData.records.map(record => record.get('keyword'));

    // 2. Use Gemini 1.5 Flash to generate high-impact SEO Content
    const prompt = `Generate a highly optimized local SEO blog post for a ${businessContext.niche} in ${businessContext.location}. Target keywords: ${targetKeywords.join(', ')}. Return clean markdown.`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: prompt,
    });
    
    const generatedContent = response.text;

    // 3. Push generated content directly to Storyblok
    await pushContentToStoryblok({ title: 'Weekly SEO Post', content: generatedContent });

    return NextResponse.json({ success: true, content: generatedContent });
  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json({ error: 'Failed to generate content' }, { status: 500 });
  }
}
