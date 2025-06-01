import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3000;

app.use(cors());
app.use('/images', express.static('previously_scanned_images'));
app.use('/processed_images', express.static(path.join(__dirname, 'processed_images')));
app.use(express.json());

const imageDataPath = path.join(__dirname, 'image_data.json');

const readImageData = async () => {
  try {
    const data = await fs.promises.readFile(imageDataPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading image_data.json:', err);
    return [];
  }
};

const writeImageData = async (data) => {
  try {
    await fs.promises.writeFile(imageDataPath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error writing to image_data.json:', err);
  }
};

// Endpoint to handle image upload
app.post('/upload', (req, res) => {
  const file = req.files.file;
  const filename = file.name;
  const savePath = path.join(__dirname, 'previously_scanned_images', filename);

  file.mv(savePath, (err) => {
    if (err) {
      console.error('Error saving image:', err);
      return res.status(500).send('Error saving image');
    }

    const imageUrl = `http://localhost:${port}/images/${filename}`;
    res.json({ imageUrl });
  });
});

// Endpoint to run YOLOv7 detection
app.post('/detect', async (req, res) => {
  const { imageUrl } = req.body;

  if (!imageUrl) {
    return res.status(400).send('Image URL is required');
  }

  const filename = path.basename(imageUrl);
  const savePath = path.join(__dirname, 'previously_scanned_images', filename);

  // Run YOLOv7 detection
  const command = `python yolov7/detect.py --source ${savePath} --weights yolov7/xray.pt --conf 0.25 --img-size 640 --save-txt --save-conf`;
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error during detection: ${stderr}`);
      return res.status(500).send('Error during detection');
    }

    const outputImagePath = path.join(__dirname, 'runs', 'detect', 'exp', filename);
    const processedImageUrl = `http://localhost:${port}/processed_images/${filename}`;

    // Move the output image to processed_images directory
    fs.rename(outputImagePath, path.join(__dirname, 'processed_images', filename), (err) => {
      if (err) {
        console.error('Error moving processed image:', err);
        return res.status(500).send('Error moving processed image');
      }

      // Read the detection results
      const labelsPath = path.join(__dirname, 'runs', 'detect', 'exp', 'labels', filename.replace('.jpg', '.txt'));
      fs.readFile(labelsPath, 'utf8', (err, data) => {
        if (err) {
          console.error('Error reading detection results:', err);
          return res.status(500).send('Error reading detection results');
        }

        const anomalies = data.split('\n').filter(line => line.trim()).map(line => {
          const [classId, x, y, w, h, conf] = line.split(' ');
          return {
            anomalyName: `Class ${classId}`,
            percentage: `${(parseFloat(conf) * 100).toFixed(2)}%`
          };
        });

        res.json({ processedImageUrl, anomalies });
      });
    });
  });
});

// Endpoint to save image data
app.post('/', async (req, res) => {
  const { imageUrl, anomalies } = req.body;

  if (!imageUrl) {
    return res.status(400).send('Image URL is required');
  }

  try {
    const imageData = await readImageData();
    imageData.unshift({ imageUrl, anomalies });
    await writeImageData(imageData);
    res.send('Image saved successfully');
  } catch (err) {
    console.error('Error saving image data:', err);
    res.status(500).send('Error saving image data');
  }
});

// Endpoint to fetch image data
app.get('/', async (req, res) => {
  try {
    const imageData = await readImageData();
    res.json(imageData);
  } catch (err) {
    res.status(500).send('Error fetching image data');
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});