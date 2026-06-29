import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { executeQuery } from '@/lib/neo4j';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { competitorData } = await request.json();

    if (!competitorData) {
      return NextResponse.json({ error: 'Competitor data is required' }, { status: 400 });
    }

    // Use Llama 3 on Groq for ultra-fast keyword extraction and analysis
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are an expert SEO analyst. Extract top keywords and identify ranking gaps from the provided competitor data. Return JSON only.',
        },
        {
          role: 'user',
          content: JSON.stringify(competitorData),
        },
      ],
      model: 'llama3-8b-8192',
      response_format: { type: 'json_object' },
    });

    const analysis = JSON.parse(chatCompletion.choices[0]?.message?.content || '{}');

    // Save insights to Neo4j to build the Knowledge Graph
    // Example: MERGE (c:Competitor) MERGE (k:Keyword) MERGE (c)-[:RANKS_FOR]->(k)
    
    return NextResponse.json({ analysis });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json({ error: 'Failed to analyze data' }, { status: 500 });
  }
}
