# OpenAI Speech-to-Text Setup Guide

This project includes a speech-to-text feature powered by OpenAI's Whisper API. Follow these steps to set it up:

## Prerequisites

1. An OpenAI account
2. An active OpenAI API key

## Setup Steps

### 1. Get Your OpenAI API Key

1. Visit [OpenAI API Keys page](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the generated API key (starts with `sk-`)

### 2. Create Environment File

Create a `.env` file in the project root directory:

```bash
cd /path/to/interactive-feedback-mcp-v2
touch .env
```

### 3. Configure the API Key

Open the `.env` file and add your configuration:

```env
# OpenAI API Configuration
# Get your API key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-your_actual_api_key_here

# Whisper Language Configuration
# Set the language for speech-to-text transcription
# Options: 'en' (English), 'vi' (Vietnamese), 'zh' (Chinese), etc.
# See full list: https://platform.openai.com/docs/guides/speech-to-text
WHISPER_LANGUAGE=vi
```

**Important Notes:**

- Replace `sk-your_actual_api_key_here` with your actual OpenAI API key
- The `.env` file is automatically ignored by git for security
- Never commit or share your API key publicly

### 4. Verify Installation

After setting up the `.env` file, the speech-to-text feature will be automatically enabled when you start the server.

You'll see this message in the console:

```
✅ OpenAI client initialized successfully
```

If there's an issue, you'll see a warning message.

## Language Options

The `WHISPER_LANGUAGE` setting determines which language Whisper will expect for transcription. Common options:

- `en` - English
- `vi` - Vietnamese (default)
- `zh` - Chinese
- `ja` - Japanese
- `ko` - Korean
- `es` - Spanish
- `fr` - French
- `de` - German

For a complete list of supported languages, visit: https://platform.openai.com/docs/guides/speech-to-text

## Troubleshooting

### Error: "OpenAI API key not configured"

- Check that your `.env` file exists in the project root
- Verify the `OPENAI_API_KEY` is correctly set
- Ensure the key starts with `sk-` and is at least 20 characters

### Error: "Invalid OpenAI API key format"

- Check that your API key starts with `sk-`
- Make sure there are no extra spaces or quotes
- Try regenerating your API key from OpenAI

### Speech-to-Text Not Working

- Verify your OpenAI account has credits
- Check your internet connection
- Ensure the audio file is in a supported format (WebM, MP3, etc.)

## Cost Information

OpenAI's Whisper API charges based on the duration of audio transcribed. Current pricing:

- $0.006 per minute (as of 2024)

For the most up-to-date pricing, visit: https://openai.com/pricing

## Security Best Practices

1. **Never commit the `.env` file** - It's already in `.gitignore`
2. **Rotate keys regularly** - Regenerate your API key periodically
3. **Monitor usage** - Check your OpenAI dashboard for unexpected usage
4. **Use environment variables** - Don't hardcode keys in your code

## Additional Resources

- [OpenAI Documentation](https://platform.openai.com/docs)
- [Whisper API Guide](https://platform.openai.com/docs/guides/speech-to-text)
- [OpenAI Node.js Library](https://github.com/openai/openai-node)

## Support

If you encounter issues not covered in this guide:

1. Check the [OpenAI Community Forum](https://community.openai.com/)
2. Review the project's GitHub issues
3. Contact the project maintainer
