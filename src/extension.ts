import * as vscode from 'vscode';
import axios from 'axios';

interface TranslationRequest {
  source_code: string;
  from_lang: string;
  to_lang: string;
  preserve_comments?: boolean;  // Made optional as it might not be required
}

interface TranslationResponse {
  source_code: string;
  from_lang: string;
  to_lang: string;
  translated_code: string;  // This contains the translated code with Markdown
  message?: string;  // Optional error message from the API
  [key: string]: any;  // Allow for additional properties
}

// Supported language pairs
const SUPPORTED_LANGUAGE_PAIRS = [
  // Python
  { from: 'python', to: 'javascript' },
  { from: 'javascript', to: 'python' },
  { from: 'python', to: 'java' },
  { from: 'java', to: 'python' },
  { from: 'python', to: 'typescript' },
  { from: 'typescript', to: 'python' },
  { from: 'python', to: 'c++' },
  { from: 'c++', to: 'python' },
  { from: 'python', to: 'c#' },
  { from: 'c#', to: 'python' },
  { from: 'python', to: 'ruby' },
  { from: 'ruby', to: 'python' },
  { from: 'python', to: 'go' },
  { from: 'go', to: 'python' },
  { from: 'python', to: 'php' },
  { from: 'php', to: 'python' },
  { from: 'python', to: 'perl' },
  { from: 'perl', to: 'python' },
  { from: 'python', to: 'fortran' },
  { from: 'fortran', to: 'python' },
  { from: 'python', to: 'pascal' },
  { from: 'pascal', to: 'python' },
  
  // JavaScript/TypeScript
  { from: 'javascript', to: 'java' },
  { from: 'java', to: 'javascript' },
  { from: 'javascript', to: 'typescript' },
  { from: 'typescript', to: 'javascript' },
  { from: 'javascript', to: 'c++' },
  { from: 'c++', to: 'javascript' },
  { from: 'javascript', to: 'c#' },
  { from: 'c#', to: 'javascript' },
  { from: 'javascript', to: 'dart' },
  { from: 'dart', to: 'javascript' },
  { from: 'javascript', to: 'html' },
  { from: 'html', to: 'javascript' },
  { from: 'javascript', to: 'php' },
  { from: 'php', to: 'javascript' },
  
  // PHP
  { from: 'php', to: 'typescript' },
  { from: 'typescript', to: 'php' },
  
  // Java
  { from: 'java', to: 'c++' },
  { from: 'c++', to: 'java' },
  { from: 'java', to: 'c#' },
  { from: 'c#', to: 'java' },
  { from: 'java', to: 'go' },
  { from: 'go', to: 'java' },
  { from: 'java', to: 'kotlin' },
  { from: 'kotlin', to: 'java' },
  { from: 'java', to: 'scala' },
  { from: 'scala', to: 'java' },
  { from: 'java', to: 'cobol' },
  { from: 'cobol', to: 'java' },
  
  // C/C++
  { from: 'c++', to: 'c' },
  { from: 'c', to: 'c++' },
  { from: 'c++', to: 'rust' },
  { from: 'rust', to: 'c++' },
  { from: 'c++', to: 'c#' },
  { from: 'c#', to: 'c++' },
  
  // Web technologies
  { from: 'css', to: 'scss' },
  { from: 'scss', to: 'css' },
  { from: 'typescript', to: 'dart' },
  { from: 'dart', to: 'typescript' },
  
  // Systems languages
  { from: 'rust', to: 'go' },
  { from: 'go', to: 'rust' },
  
  // Framework-specific translations
  { from: 'flask', to: 'express' },
  { from: 'express', to: 'flask' },
  { from: 'django', to: 'spring' },
  { from: 'spring', to: 'django' },
  { from: 'vue', to: 'react' },
  { from: 'react', to: 'vue' },
  { from: 'jsx', to: 'tsx' },
  { from: 'tsx', to: 'jsx' },
  { from: 'vue', to: 'svelte' },
  { from: 'svelte', to: 'vue' },
  { from: 'angular', to: 'react' },
  { from: 'react', to: 'angular' },
  
  // Newer languages
  { from: 'swift', to: 'kotlin' },
  { from: 'kotlin', to: 'swift' }
];

// Map file extensions to language identifiers
const EXTENSION_TO_LANGUAGE: { [key: string]: string } = {
  // Python
  '.py': 'python',
  
  // JavaScript/TypeScript
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  
  // Java/Kotlin/Scala
  '.java': 'java',
  '.kt': 'kotlin',
  '.scala': 'scala',
  
  // C/C++/C#
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'c++',
  '.hpp': 'c++',
  '.cc': 'c++',
  '.cs': 'c#',
  
  // Go
  '.go': 'go',
  
  // Ruby
  '.rb': 'ruby',
  
  // PHP
  '.php': 'php',
  
  // Perl
  '.pl': 'perl',
  '.pm': 'perl',
  
  // Web
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  
  // Swift
  '.swift': 'swift',
  
  // Dart
  '.dart': 'dart',
  
  // Rust
  '.rs': 'rust',
  
  // Framework-specific
  '.vue': 'vue',
  '.svelte': 'svelte',
  
  // Legacy languages
  '.cbl': 'cobol',
  '.cob': 'cobol',
  '.f': 'fortran',
  '.for': 'fortran',
  '.f90': 'fortran',
  '.pas': 'pascal',
  '.pp': 'pascal',
  
  // Framework configuration files
  'pom.xml': 'spring',
  'build.gradle': 'spring',
  'build.gradle.kts': 'spring',
  'application.properties': 'spring',
  'application.yml': 'spring',
  'application.yaml': 'spring',
  'requirements.txt': 'flask',
  'app.py': 'flask',
  'manage.py': 'django',
  'urls.py': 'django',
  'settings.py': 'django',
  'package.json': 'express',
  'server.js': 'express',
  'app.js': 'express'
};

// Get supported target languages for a given source language
function getSupportedTargetLanguages(sourceLang: string): string[] {
  return Array.from(
    new Set(
      SUPPORTED_LANGUAGE_PAIRS
        .filter(pair => pair.from === sourceLang)
        .map(pair => pair.to)
    )
  );
}

// Check if a language pair is supported
function isLanguagePairSupported(fromLang: string, toLang: string): boolean {
  return SUPPORTED_LANGUAGE_PAIRS.some(
    pair => pair.from === fromLang && pair.to === toLang
  );
}

async function translateCode(
  code: string,
  sourceLanguage: string,
  targetLanguage: string,
  preserveComments: boolean = true
): Promise<string> {
  const config = vscode.workspace.getConfiguration('polygot');
  const apiEndpoint = config.get<string>('apiEndpoint', 'https://translate.u16p.com/api/v1/translate');

  // Use the provided language codes directly
  const sourceLang = sourceLanguage;
  const targetLang = targetLanguage;

  // Check if the language pair is supported
  if (!isLanguagePairSupported(sourceLang, targetLang)) {
    const message = `Translation from ${sourceLang} to ${targetLang} is not currently supported.\n\n` +
      `If you need this translation, please contact us at info@unelmaplatforms.com to request support for this language pair.`;
    
    vscode.window.showErrorMessage(message, 'Copy Email Address')
      .then(selection => {
        if (selection === 'Copy Email Address') {
          vscode.env.clipboard.writeText('info@unelmaplatforms.com');
        }
      });
    
    throw new Error(`Translation from ${sourceLang} to ${targetLang} is not supported.`);
  }

  // Prepare the request payload according to the API's expected format
  const requestPayload = {
    source_code: code,  // API expects 'source_code' instead of 'code'
    from_lang: sourceLang,  // API expects 'from_lang' instead of 'sourceLanguage'
    to_lang: targetLang,   // API expects 'to_lang' instead of 'targetLanguage'
    preserve_comments: preserveComments  // Note: check if the API supports this parameter
  };

  console.log('Sending translation request:', {
    endpoint: apiEndpoint,
    payload: requestPayload
  });

  try {
    const response = await axios.post<TranslationResponse>(
      apiEndpoint,
      requestPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000, // 30 seconds timeout
        validateStatus: () => true // Always resolve the promise
      }
    );

    console.log('Translation response status:', response.status);
    console.log('Response headers:', response.headers);
    // Log a preview of the response data to avoid logging large responses
    console.log('Response data preview:', {
      ...response.data,
      source_code: response.data.source_code ? '[source code]' : undefined,
      translated_code: response.data.translated_code ? 
        response.data.translated_code.substring(0, 100) + 
        (response.data.translated_code.length > 100 ? '...' : '') : undefined
    });

    if (response.status >= 200 && response.status < 300) {
      if (response.data && response.data.translated_code) {
        // Extract the code from Markdown code blocks if present
        const translatedCode = response.data.translated_code;
        // Remove Markdown code block syntax if present
        const codeWithoutMarkdown = translatedCode
          .replace(/^```[\s\S]*?\n/, '')  // Remove opening code block
          .replace(/\n```$/, '')           // Remove closing code block
          .trim();
        
        return codeWithoutMarkdown;
      } else {
        throw new Error('Invalid response format from translation service');
      }
    } else {
      const errorMessage = response.data?.message || 
                         response.statusText || 
                         `Request failed with status ${response.status}`;
      throw new Error(`Translation failed: ${errorMessage}`);
    }
  } catch (error: any) {
    console.error('Translation error details:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data,
      stack: error.stack
    });
    
    if (error.response?.data?.message) {
      throw new Error(`Translation failed: ${error.response.data.message}`);
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Translation request timed out. Please try again.');
    } else if (error.code === 'ENOTFOUND') {
      throw new Error('Could not connect to the translation service. Please check your internet connection.');
    } else {
      throw new Error(`Failed to translate code: ${error.message}`);
    }
  }
}

// Get language from file name
export function getLanguageFromFileName(fileName: string): string | undefined {
  // First check for exact filename matches (like package.json, pom.xml, etc.)
  const fileNameLower = fileName.toLowerCase();
  
  // Check for framework configuration files first
  const frameworkFiles = [
    'pom.xml', 'build.gradle', 'build.gradle.kts', 
    'application.properties', 'application.yml', 'application.yaml',
    'requirements.txt', 'app.py', 'manage.py', 'urls.py', 
    'settings.py', 'package.json', 'server.js', 'app.js'
  ];
  
  for (const file of frameworkFiles) {
    if (fileNameLower.endsWith(file)) {
      return EXTENSION_TO_LANGUAGE[file];
    }
  }
  
  // Check for file extensions
  const extension = fileName.substring(fileName.lastIndexOf('.'));
  return EXTENSION_TO_LANGUAGE[extension.toLowerCase()] || 
         // Fallback for common framework files
         (fileName.endsWith('.vue') ? 'vue' :
          fileName.endsWith('.svelte') ? 'svelte' :
          fileName.endsWith('.jsx') ? 'jsx' :
          fileName.endsWith('.tsx') ? 'tsx' :
          undefined);
}

async function translateSelection() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor');
    return;
  }

  const selection = editor.selection;
  if (selection.isEmpty) {
    vscode.window.showInformationMessage('Please select some code to translate');
    return;
  }

  const selectedText = editor.document.getText(selection);
  const sourceLanguage = getLanguageFromFileName(editor.document.fileName);
  
  if (!sourceLanguage) {
    vscode.window.showErrorMessage('Could not determine source language from file extension');
    return;
  }

  await showTranslationDialog(selectedText, sourceLanguage);
}

async function showTranslationDialog(code: string, sourceLanguage: string) {
  const config = vscode.workspace.getConfiguration('polygot');
  // Get supported target languages for the current source language
  const supportedTargets = getSupportedTargetLanguages(sourceLanguage);
  
  if (supportedTargets.length === 0) {
    const message = `No supported target languages for ${sourceLanguage}.\n\n` +
      `If you need support for this language, please contact us at info@unelmaplatforms.com`;
    
    vscode.window.showErrorMessage(message, 'Copy Email Address')
      .then(selection => {
        if (selection === 'Copy Email Address') {
          vscode.env.clipboard.writeText('info@unelmaplatforms.com');
        }
      });
    return;
  }

  // Map language codes to display names
  const languageDisplayNames: {[key: string]: string} = {
    'python': 'Python',
    'javascript': 'JavaScript',
    'typescript': 'TypeScript',
    'java': 'Java',
    'c#': 'C#',
    'c++': 'C++',
    'c': 'C',
    'go': 'Go',
    'rust': 'Rust',
    'ruby': 'Ruby',
    'php': 'PHP',
    'perl': 'Perl',
    'swift': 'Swift',
    'kotlin': 'Kotlin',
    'scala': 'Scala',
    'dart': 'Dart',
    'html': 'HTML',
    'css': 'CSS',
    'scss': 'SCSS',
    'cobol': 'COBOL',
    'fortran': 'Fortran',
    'pascal': 'Pascal',
    // Framework-specific
    'flask': 'Flask (Python)',
    'express': 'Express.js',
    'django': 'Django (Python)',
    'spring': 'Spring Boot (Java)',
    'vue': 'Vue.js',
    'react': 'React',
    'angular': 'Angular',
    'svelte': 'Svelte',
    'jsx': 'React (JSX)',
    'tsx': 'React (TSX)'
  };

  // Create quick pick items with display names
  const quickPickItems = supportedTargets.map(lang => ({
    label: languageDisplayNames[lang] || lang.charAt(0).toUpperCase() + lang.slice(1),
    description: `Translate to ${languageDisplayNames[lang] || lang}`,
    lang: lang
  }));

  const selectedItem = await vscode.window.showQuickPick(
    quickPickItems,
    { 
      placeHolder: 'Select target language',
      canPickMany: false,
      matchOnDescription: true,
      ignoreFocusOut: true
    }
  );

  if (!selectedItem) {
    return;
  }

  const targetLanguage = selectedItem.lang;
  const preserveComments = config.get<boolean>('preserveComments', true);
  
  try {
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Translating from ${sourceLanguage} to ${targetLanguage}...`,
        cancellable: true
      },
      async (progress, token) => {
        try {
          const translatedCode = await translateCode(
            code,
            sourceLanguage,
            targetLanguage,
            preserveComments
          );
          
          if (token.isCancellationRequested) {
            return;
          }
          
          showTranslatedCode(translatedCode, targetLanguage);
        } catch (error) {
          if (!token.isCancellationRequested) {
            vscode.window.showErrorMessage(
              error instanceof Error ? error.message : 'Translation failed'
            );
          }
        }
      }
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      error instanceof Error ? error.message : 'Translation failed'
    );
  }
}

async function showTranslatedCode(code: string, language: string) {
  const doc = await vscode.workspace.openTextDocument({
    language,
    content: code
  });
  
  await vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.Beside });
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Polygot Code Translator is now active!');

  const translateSelectionCommand = vscode.commands.registerCommand('polygot.translateSelection', translateSelection);
  
  const translateCodeCommand = vscode.commands.registerCommand('polygot.translateCode', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor');
      return;
    }

    const sourceLanguage = getLanguageFromFileName(editor.document.fileName);
    if (!sourceLanguage) {
      vscode.window.showErrorMessage('Could not determine source language from file extension');
      return;
    }

    await showTranslationDialog(editor.document.getText(), sourceLanguage);
  });

  context.subscriptions.push(translateSelectionCommand, translateCodeCommand);
}

export function deactivate() {}
