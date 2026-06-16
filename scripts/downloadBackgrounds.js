import fs from 'fs';
import path from 'path';
import https from 'https';

const BACKGROUNDS = [
  {
    name: 'forest.mp4',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-forest-stream-in-the-sunlight-529-large.mp4'
  },
  {
    name: 'stars.mp4',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-starry-night-sky-in-motion-11001-large.mp4'
  },
  {
    name: 'rain.mp4',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-rain-drops-on-a-window-pane-1823-large.mp4'
  }
];

const targetDir = path.resolve('public/backgrounds');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

console.log('Downloading default background video loops...');

const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    };
    https.get(url, options, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get '${url}' (Status Code: ${response.statusCode})`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded: ${path.basename(dest)}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
};

async function main() {
  for (const bg of BACKGROUNDS) {
    const destPath = path.join(targetDir, bg.name);
    console.log(`Starting download for ${bg.name}...`);
    try {
      await downloadFile(bg.url, destPath);
    } catch (error) {
      console.error(`Error downloading ${bg.name}:`, error.message);
    }
  }
  console.log('All downloads completed!');
}

main();
