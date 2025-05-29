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
  { from: 'python', to: 'javascript' },
  { from: 'javascript', to: 'python' },
  { from: 'python', to: 'java' },
  { from: 'java', to: 'python' },
  { from: 'javascript', to: 'java' },
  { from: 'java', to: 'javascript' },
  { from: 'cobol', to: 'java' },
  { from: 'java', to: 'cobol' }
];

// Map file extensions to language identifiers
const EXTENSION_TO_LANGUAGE: { [key: string]: string } = {
  '.py': 'python',
  '.js': 'javascript',
  '.java': 'java',
  '.cbl': 'cobol',
  '.cob': 'cobol'
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

function getLanguageFromFileName(fileName: string): string | undefined {
  const extension = fileName.substring(fileName.lastIndexOf('.'));
  const language = EXTENSION_TO_LANGUAGE[extension];
  
  // Check if the language is in any of our supported pairs
  const isSupported = SUPPORTED_LANGUAGE_PAIRS.some(
    pair => pair.from === language || pair.to === language
  );
  
  return isSupported ? language : undefined;
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

  const targetLanguage = await vscode.window.showQuickPick(
    supportedTargets,
    { 
      placeHolder: 'Select target language',
      canPickMany: false,
      ignoreFocusOut: true
    }
  );

  if (!targetLanguage) {
    return;
  }

  const preserveComments = config.get<boolean>('preserveComments', true);
  
  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Translating code...',
        cancellable: false
      },
      async () => {
        const translatedCode = await translateCode(code, sourceLanguage, targetLanguage, preserveComments);
        await showTranslatedCode(translatedCode, targetLanguage);
      }
    );
  } catch (error) {
    vscode.window.showErrorMessage(error instanceof Error ? error.message : 'An unknown error occurred');
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
