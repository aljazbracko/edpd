require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const NodeCache = require('node-cache');
const fs = require('fs/promises');
const path = require('path');

const app = express();
app.use(express.json());

const SECRET = process.env.JWT_SECRET;
const cache = new NodeCache();

// Poti do JSON "baz"
const CONTENTS_FILE = path.join(__dirname, 'data', 'contents.json');
const LOGS_FILE = path.join(__dirname, 'data', 'logs.json');

// Helper za branje in pisanje datotek
const readJson = async (file) => {
  try {
    const data = await fs.readFile(file, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
};

const writeJson = async (file, data) => {
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
};

// POST /addContent
app.post('/addContent', async (req, res) => {
  const { value } = req.body;
  const data_id = uuidv4();
  const contents = await readJson(CONTENTS_FILE);
  contents.push({ data_id, value });
  await writeJson(CONTENTS_FILE, contents);
  res.json({ data_id });
});

// GET /getContent
app.get('/getContent', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'JWT required' });

  try {
    const decoded = jwt.verify(token, SECRET);
    const signature = token;


    if (cache.get(signature)) {
      return res.status(403).json({ error: 'Token already used' });
    }

    cache.set(signature, true, decoded.exp - Math.floor(Date.now() / 1000));
    const contents = await readJson(CONTENTS_FILE);
    const item = contents.find(c => c.data_id === decoded.data_id);

    if (!item) return res.status(404).json({ error: 'Content not found' });

    const logs = await readJson(LOGS_FILE);
    logs.push({
      signature,
      data_id: decoded.data_id,
      subject: decoded.sub,
      access_time: new Date().toISOString()
    });
    await writeJson(LOGS_FILE, logs);

    res.json({ value: item.value });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// GET /getHistory
app.get('/getHistory', async (req, res) => {
  const logs = await readJson(LOGS_FILE);
  res.json(logs);
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`API running on http://localhost:${process.env.PORT}`);
});
