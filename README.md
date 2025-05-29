# Polygot Code Translator

A VS Code extension that translates code between multiple programming languages using AI. Easily convert code snippets or entire files between popular programming languages with just a few clicks.

## Features

- **In-Editor Code Translation**: Right-click and translate selected code blocks to your target language
- **Multiple Language Support**: Supports translation between Python, JavaScript, TypeScript, Java, C#, C++, Rust, Go, Ruby, PHP, and Swift
- **Context-Aware**: Automatically detects the source language based on file extension
- **Preserve Comments**: Option to preserve comments during translation
- **Side-by-Side Preview**: View translated code in a new editor tab

## Getting Started

1. Install the extension from the VS Code marketplace
2. Open a code file in your editor
3. Select the code you want to translate
4. Right-click and select "Translate Selection" from the context menu
5. Choose your target language from the dropdown
6. View the translated code in a new editor tab

## Extension Settings

This extension contributes the following settings:

* `polygot.apiEndpoint`: API endpoint for the translation service (default: `https://translate.u16p.com/api/v1/translate`)
* `polygot.defaultTargetLanguage`: Default target language for translation (default: `javascript`)
* `polygot.preserveComments`: Whether to preserve comments during translation (default: `true`)

## Available Commands

- `Polygot: Translate Code`: Translate the entire current file
- `Polygot: Translate Selection`: Translate the currently selected code

## Supported Language Pairs

The extension supports the following language translations:

- Python ↔ JavaScript
- Python ↔ Java
- JavaScript ↔ Java
- Java ↔ COBOL

Supported file extensions:
- Python: `.py`
- JavaScript: `.js`
- Java: `.java`
- COBOL: `.cbl`, `.cob`

### Requesting New Language Pairs

If you need support for additional language pairs, please contact us at [info@unelmaplatforms.com](mailto:info@unelmaplatforms.com) with your request. We're constantly working to add support for more programming languages and would love to hear about your needs.

## Requirements

- VS Code 1.85.0 or higher
- Active internet connection for API access

## Known Issues

- Large files may take longer to translate
- Some language-specific features may not translate perfectly and may require manual adjustment

## Release Notes

### 0.1.0

Initial release of Polygot Code Translator with support for multiple programming languages and basic translation features.

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
