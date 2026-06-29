import neo4j from 'neo4j-driver';

// Initialize Neo4j driver
// In production, these should come from process.env
const uri = process.env.NEO4J_URI || 'neo4j+s://your-neo4j-uri';
const user = process.env.NEO4J_USER || 'neo4j';
const password = process.env.NEO4J_PASSWORD || 'password';

export const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

export async function closeDriver() {
  await driver.close();
}

/**
 * Example function to execute a GraphRAG query
 */
export async function executeQuery(query: string, params = {}) {
  const session = driver.session();
  try {
    const result = await session.run(query, params);
    return result;
  } finally {
    await session.close();
  }
}
