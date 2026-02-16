#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'discord_bot',
  user: process.env.DB_USER || 'bot_user',
  password: process.env.DB_PASSWORD
};

if (process.env.DB_SSL === 'true') {
  config.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(config);

async function runMigration(direction = 'up') {
  const migrationsDir = path.join(__dirname, '../migrations');
  
  try {
    // Create migrations tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Get all migration files
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (direction === 'up') {
      // Get already executed migrations
      const { rows } = await pool.query(
        'SELECT migration_name FROM schema_migrations'
      );
      const executed = new Set(rows.map(r => r.migration_name));

      for (const file of files) {
        if (!executed.has(file)) {
          console.log(`Running migration: ${file}`);
          const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
          
          await pool.query('BEGIN');
          try {
            await pool.query(sql);
            await pool.query(
              'INSERT INTO schema_migrations (migration_name) VALUES ($1)',
              [file]
            );
            await pool.query('COMMIT');
            console.log(`✓ Migration ${file} completed`);
          } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
          }
        } else {
          console.log(`- Migration ${file} already executed`);
        }
      }
    } else if (direction === 'down') {
      // Get last migration
      const { rows } = await pool.query(
        'SELECT migration_name FROM schema_migrations ORDER BY executed_at DESC LIMIT 1'
      );
      
      if (rows.length > 0) {
        const lastMigration = rows[0].migration_name;
        console.log(`Rolling back migration: ${lastMigration}`);
        
        await pool.query('BEGIN');
        try {
          // Note: For down migrations, you'd need separate rollback SQL files
          // For now, we just remove from tracking
          await pool.query(
            'DELETE FROM schema_migrations WHERE migration_name = $1',
            [lastMigration]
          );
          await pool.query('COMMIT');
          console.log(`✓ Migration ${lastMigration} rolled back (tracking only)`);
          console.log('Warning: Manual database cleanup may be required');
        } catch (error) {
          await pool.query('ROLLBACK');
          throw error;
        }
      } else {
        console.log('No migrations to roll back');
      }
    }

    console.log('\n✅ Migration process completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Get direction from command line
const direction = process.argv[2] || 'up';

if (!['up', 'down'].includes(direction)) {
  console.error('Usage: node migrate.js [up|down]');
  process.exit(1);
}

runMigration(direction);
