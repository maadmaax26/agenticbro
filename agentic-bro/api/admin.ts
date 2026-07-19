const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  try {
    const html = fs.readFileSync(path.join(__dirname, 'admin-page.html'), 'utf-8');
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
  } catch (e) {
    return res.status(500).send('Admin page not found: ' + e.message);
  }
};
