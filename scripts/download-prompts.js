#!/usr/bin/env node

/**
 * Download Prompts from GCS
 *
 * Downloads prompt files from Google Cloud Storage at container startup.
 * Uses the @google-cloud/storage client instead of gsutil.
 */

const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

const GCS_PROMPTS_PATH = process.env.GCS_PROMPTS_PATH;
const LOCAL_PROMPTS_DIR = process.env.PROMPTS_DIR || '/app/prompts';

async function downloadPrompts() {
  if (!GCS_PROMPTS_PATH) {
    console.log('GCS_PROMPTS_PATH not set. Using default prompts...');
    return;
  }

  // Parse GCS path: gs://bucket-name/prefix
  const match = GCS_PROMPTS_PATH.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match) {
    console.error('Invalid GCS_PROMPTS_PATH format. Expected: gs://bucket-name/path');
    console.log('Using default prompts...');
    return;
  }

  const [, bucketName, prefix] = match;
  console.log(`Downloading prompts from gs://${bucketName}/${prefix}...`);

  try {
    const storage = new Storage();
    const bucket = storage.bucket(bucketName);

    // List all files with the given prefix
    const [files] = await bucket.getFiles({ prefix });

    if (files.length === 0) {
      console.log('No prompt files found in GCS. Using default prompts...');
      return;
    }

    // Ensure local directory exists
    if (!fs.existsSync(LOCAL_PROMPTS_DIR)) {
      fs.mkdirSync(LOCAL_PROMPTS_DIR, { recursive: true });
    }

    // Download each file
    let downloadCount = 0;
    for (const file of files) {
      // Skip "directory" entries
      if (file.name.endsWith('/')) continue;

      // Calculate relative path
      const relativePath = file.name.substring(prefix.length).replace(/^\//, '');
      if (!relativePath) continue;

      const localPath = path.join(LOCAL_PROMPTS_DIR, relativePath);
      const localDir = path.dirname(localPath);

      // Ensure subdirectory exists
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }

      // Download file
      await file.download({ destination: localPath });
      downloadCount++;
      console.log(`  Downloaded: ${relativePath}`);
    }

    console.log(`Prompts downloaded successfully. (${downloadCount} files)`);
  } catch (error) {
    console.error('Failed to download prompts from GCS:', error.message);
    console.log('Using default prompts...');
  }
}

// Run if called directly
if (require.main === module) {
  downloadPrompts().catch(console.error);
}

module.exports = { downloadPrompts };
