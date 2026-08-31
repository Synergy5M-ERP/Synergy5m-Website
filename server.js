const express = require("express");
const path = require("path");

const app = express();

const buildPath = path.join(__dirname, "build");

// Serve React production files
app.use(express.static(buildPath));

// React SPA fallback
app.use((req, res) => {
    res.sendFile(path.join(buildPath, "index.html"));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Production server running on port ${PORT}`);
});