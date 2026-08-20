# Support

## Getting Help

If you need help with YouTube MCP Tools, here are your options:

### 📖 Documentation

- [README](README.md) - Full feature documentation and setup guide
- [CHANGELOG](CHANGELOG.md) - Version history and updates

### 🐛 Bug Reports

Found a bug? Please [open an issue](https://github.com/fabioc-aloha/youtube-mcp-vscode/issues/new) with:

- VS Code version
- Extension version
- Steps to reproduce
- Expected vs actual behavior

### 💡 Feature Requests

Have an idea? [Open a feature request](https://github.com/fabioc-aloha/youtube-mcp-vscode/issues/new) describing:

- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

### 💬 Discussions

For questions and general discussion, visit our [GitHub Discussions](https://github.com/fabioc-aloha/youtube-mcp-vscode/discussions).

## YouTube API Quota

This extension uses the YouTube Data API v3. Key points:

- **Daily Quota**: 10,000 units per day (free tier)
- **Search**: 100 units per request
- **Video Details**: 1 unit per request
- **Transcripts**: Uses timedtext API (no quota cost)

Use the "Show Quota Status" command to monitor your usage.

## Common Issues

### "API Key Invalid"

1. Verify your key at [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Ensure YouTube Data API v3 is enabled
3. Check for typos in the key

### "Quota Exceeded"

Wait until midnight Pacific Time for quota reset, or create a new project with a fresh quota.

### "Transcript Not Available"

Not all videos have captions. Try a different video or check if captions are enabled.

---

**Maintainer**: [Fabio Correa](https://correax.com) | [CorreaX](https://correax.com)
