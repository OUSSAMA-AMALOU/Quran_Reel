export default async function handler(req, res) {
  const { ie = 'UTF-8', tl = 'ar', client = 'tw-ob', q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing q parameter' });

  const url = `https://translate.google.com/translate_tts?ie=${ie}&tl=${tl}&client=${client}&q=${encodeURIComponent(q)}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Referer': 'https://translate.google.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    const buffer = await response.arrayBuffer();
    res.setHeader('Content-Type', response.headers.get('content-type') || 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(response.status).send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
