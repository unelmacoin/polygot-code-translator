import * as vscode from 'vscode';
import axios, { AxiosError, AxiosResponse } from 'axios';

// Track API status
let isApiHealthy = true;
let lastApiCheck = 0; // Track when we last checked the API status
const API_HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

async function testConnection(url: string): Promise<{ success: boolean; status?: number; message: string }> {
  try {
    console.log(`Testing connection to: ${url}`);
    const startTime = Date.now();
    
    const response = await axios.head(url, {
      timeout: 10000,
      validateStatus: () => true
    });
    
    const responseTime = Date.now() - startTime;
    console.log(`Connection test to ${url} succeeded in ${responseTime}ms with status ${response.status}`);
    
    return {
      success: response.status < 400,
      status: response.status,
      message: `Connection successful (${response.status} in ${responseTime}ms)`
    };
  } catch (error: any) {
    console.error(`Connection test to ${url} failed:`, {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    
    return {
      success: false,
      message: `Connection failed: ${error.code || error.message}`
    };
  }
}

async function checkApiHealth(apiEndpoint: string): Promise<{ isHealthy: boolean; message?: string }> {
  const now = Date.now();
  
  // Only check once every 5 minutes to avoid too many requests
  if (now - lastApiCheck < API_HEALTH_CHECK_INTERVAL) {
    return { isHealthy: isApiHealthy };
  }
  
  const healthCheckUrl = apiEndpoint.replace(/\/translate$/, '/health');
  
  try {
    console.log(`Checking API health at: ${healthCheckUrl}`);
    lastApiCheck = now;
    
    const response = await axios.get(healthCheckUrl, {
      timeout: 10000, // 10 seconds timeout
      validateStatus: () => true, // Don't throw on any status code
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    isApiHealthy = response.status === 200;
    
    if (!isApiHealthy) {
      console.warn(`API health check failed with status ${response.status}:`, {
        status: response.status,
        statusText: response.statusText,
        data: response.data
      });
    }
    
    return {
      isHealthy: isApiHealthy,
      message: isApiHealthy ? 'API is healthy' : `API returned status ${response.status}`
    };
  } catch (error: any) {
    console.error('API health check failed:', {
      message: error.message,
      code: error.code,
      url: healthCheckUrl,
      stack: error.stack
    });
    
    isApiHealthy = false;
    return {
      isHealthy: false,
      message: `Connection failed: ${error.code || error.message}`
    };
  }
}

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
  sourceLang: string,
  targetLang: string,
  preserveComments: boolean = true,
  retryCount: number = 1
): Promise<string> {
  // Add network diagnostics
  const networkInfo = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    env: {
      http_proxy: process.env.HTTP_PROXY || process.env.http_proxy || 'Not set',
      https_proxy: process.env.HTTPS_PROXY || process.env.https_proxy || 'Not set',
      no_proxy: process.env.NO_PROXY || process.env.no_proxy || 'Not set',
      node_tls_reject_unauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED || 'Not set',
      NODE_DEBUG: process.env.NODE_DEBUG || 'Not set',
      NODE_OPTIONS: process.env.NODE_OPTIONS || 'Not set'
    }
  };
  console.log('Network diagnostics:', networkInfo);

  const config = vscode.workspace.getConfiguration('polygot');
  const apiEndpoint = config.get<string>('apiEndpoint', 'https://translate.u16p.com/api/v1/translate');
  const maxRetries = 1; // Reduced retries since we're seeing consistent timeouts
  const timeoutMs = 10000; // Reduced to 10 seconds for faster failure detection
  
  // Log the translation request details
  console.log('Translation request details:', {
    sourceLang,
    targetLang,
    codeLength: code.length,
    preserveComments,
    retryCount,
    maxRetries,
    timeoutMs
  });

  try {
    // Check API health before proceeding
    const healthCheck = await checkApiHealth(apiEndpoint);
    if (!healthCheck.isHealthy) {
      console.warn('API health check failed:', healthCheck.message);

      // Test connection to the API endpoint directly
      const connectionTest = await testConnection(apiEndpoint);
      console.log('Connection test result:', connectionTest);

      const errorMessage = `The translation service is currently unavailable.\n` +
        `Health Check: ${healthCheck.message}\n` +
        `Connection Test: ${connectionTest.message}`;

      const result = await vscode.window.showErrorMessage(
        errorMessage,
        'Try Anyway', 
        'Check Again',
        'Open Network Settings',
        'Cancel'
      );

      if (result === 'Check Again') {
        lastApiCheck = 0; // Reset the last API check to force a recheck
        return translateCode(code, sourceLang, targetLang, preserveComments, retryCount);
      } else if (result === 'Open Network Settings') {
        vscode.commands.executeCommand('workbench.action.network.settings');
        throw new Error('Please check your network settings and try again.');
      } else if (result !== 'Try Anyway') {
        throw new Error('Translation aborted by user');
      }
      console.log('User chose to try translation despite connection issues');
    }

    // Show a warning if the code is too large
    const MAX_CODE_LENGTH = 10000; // 10KB
    if (code.length > MAX_CODE_LENGTH) {
      const message = `The code is too large (${code.length} characters). ` +
        `Please try with a smaller piece of code (under ${MAX_CODE_LENGTH} characters).`;
      vscode.window.showWarningMessage(message);
      throw new Error('Code too large for translation');
    }

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
    const requestPayload: TranslationRequest = {
      source_code: code,
      from_lang: sourceLang,
      to_lang: targetLang,
      preserve_comments: preserveComments
    };

    console.log('Sending translation request:', {
      endpoint: apiEndpoint,
      from: sourceLang,
      to: targetLang,
      codeLength: code.length,
      retryCount
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await axios.post<TranslationResponse>(
        apiEndpoint,
        requestPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          signal: controller.signal,
          timeout: timeoutMs,
          validateStatus: (status) => status < 500 // Don't throw for 4xx errors
        }
      );

      clearTimeout(timeoutId);

      console.log('Translation response status:', response.status);
      
      if (response.status >= 200 && response.status < 300) {
        if (response.data?.translated_code) {
          // Extract the code from Markdown code blocks if present
          const translatedCode = response.data.translated_code;
          // Remove Markdown code block syntax if present
          const codeWithoutMarkdown = translatedCode
            .replace(/^```[\s\S]*?\n/, '')  // Remove opening code block
            .replace(/\n```$/, '')           // Remove closing code block
            .trim();
          
          if (!codeWithoutMarkdown) {
            throw new Error('Received empty translation from the server');
          }
          
          return codeWithoutMarkdown;
        } else {
          throw new Error('Invalid response format from translation service: Missing translated_code');
        }
      } else {
        const errorMessage = response.data?.message || 
                           response.statusText || 
                           `Request failed with status ${response.status}`;
        throw new Error(`Translation failed: ${errorMessage}`);
      }
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED' || error.response?.status === 504) {
          // Handle timeout or gateway timeout
          if (retryCount > 0) {
            console.log(`Retrying... (${maxRetries - retryCount + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return translateCode(code, sourceLang, targetLang, preserveComments, retryCount - 1);
          }
          throw new Error('Translation service is currently unavailable. The request timed out.');
        }
        
        if (error.response) {
          // Handle HTTP errors (4xx, 5xx)
          const status = error.response.status;
          const message = error.response.data?.message || error.message || 'Unknown error occurred';
          
          if (status === 429) {
            // Rate limited
            const retryAfter = parseInt(error.response.headers['retry-after'] || '5', 10) * 1000;
            if (retryCount > 0) {
              await new Promise(resolve => setTimeout(resolve, retryAfter));
              return translateCode(code, sourceLang, targetLang, preserveComments, retryCount - 1);
            }
            throw new Error('Translation service rate limit exceeded. Please try again later.');
          }
          
          throw new Error(`Translation failed (${status}): ${message}`);
        } else if (error.request) {
          // The request was made but no response was received
          throw new Error('No response received from the translation service. Please check your connection.');
        } else {
          // Something happened in setting up the request
          throw new Error(`Failed to send translation request: ${error.message}`);
        }
      }
      
      // For non-Axios errors
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      throw new Error(`Translation failed: ${errorMessage}`);
    }
  } catch (error: unknown) {
    console.error('Translation error:', error);
    
    // For Axios errors
    if (axios.isAxiosError(error)) {
      // Handle timeout or gateway timeout
      if (error.code === 'ECONNABORTED' || error.response?.status === 504) {
        const retryInfo = `Retry ${maxRetries - retryCount + 1} of ${maxRetries}`;
        console.warn(`Translation service timeout. ${retryInfo}`);
        
        if (retryCount > 0) {
          console.log(`Retrying... (${retryInfo})`);
          // Add exponential backoff with jitter
          const backoffTime = Math.min(1000 * Math.pow(2, maxRetries - retryCount), 30000);
          const jitter = Math.floor(Math.random() * 1000);
          await new Promise(resolve => setTimeout(resolve, backoffTime + jitter));
          return translateCode(code, sourceLang, targetLang, preserveComments, retryCount - 1);
        }
        
        const message = 'The translation service is currently unavailable or timed out.\n\n' +
          'This could be due to high server load or maintenance.\n' +
          'Please try again later or contact support if the issue persists.';
        
        const response = await vscode.window.showErrorMessage(
          message, 
          'Retry', 
          'Open Documentation',
          'Show Network Diagnostics'
        );
        
        if (response === 'Retry') {
          vscode.commands.executeCommand('polygot.translateCode');
        } else if (response === 'Open Documentation') {
          vscode.env.openExternal(vscode.Uri.parse('https://unelmasupport.com'));
        } else if (response === 'Show Network Diagnostics') {
          const diagnostics = `### Network Diagnostics
- **Time**: ${new Date().toISOString()}
- **Node Version**: ${process.version}
- **Platform**: ${process.platform}
- **Architecture**: ${process.arch}
- **Proxy Settings**:
  - HTTP_PROXY: ${process.env.HTTP_PROXY || 'Not set'}
  - HTTPS_PROXY: ${process.env.HTTPS_PROXY || 'Not set'}
  - NO_PROXY: ${process.env.NO_PROXY || 'Not set'}
- **Code Length**: ${code.length} characters
- **Source Language**: ${sourceLang}
- **Target Language**: ${targetLang}`;
          
          const doc = await vscode.workspace.openTextDocument({
            content: diagnostics,
            language: 'markdown'
          });
          await vscode.window.showTextDocument(doc, { preview: false });
        }
        
        throw new Error('Translation service unavailable. Please try again later.');
      }
      
      // Handle HTTP errors (4xx, 5xx)
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.message || error.message || 'Unknown error occurred';
        
        if (status === 429) {
          // Rate limited
          const retryAfter = parseInt(error.response.headers['retry-after'] || '5', 10) * 1000;
          if (retryCount > 0) {
            await new Promise(resolve => setTimeout(resolve, retryAfter));
            return translateCode(code, sourceLang, targetLang, preserveComments, retryCount - 1);
          }
          throw new Error('Translation service rate limit exceeded. Please try again later.');
        }
        
        if (status === 413) {
          throw new Error('The code is too large to translate. Please reduce the size and try again.');
        }
        
        throw new Error(`Translation failed (${status}): ${message}`);
      } 
      
      // Handle request errors
      if (error.request) {
        // The request was made but no response was received
        if (retryCount > 0 && (
          error.code === 'ECONNRESET' ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ENOTFOUND'
        )) {
          console.log(`Retrying... (${maxRetries - retryCount + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, maxRetries - retryCount)));
          return translateCode(code, sourceLang, targetLang, preserveComments, retryCount - 1);
        }
        
        if (error.code === 'ENOTFOUND') {
          throw new Error('Could not connect to the translation service. Please check your internet connection.');
        } else if (error.code === 'ECONNRESET') {
          throw new Error('Connection to the translation service was reset. Please try again.');
        } else {
          throw new Error('No response received from the translation service. Please check your connection.');
        }
      }
      
      // Something happened in setting up the request
      throw new Error(`Failed to send translation request: ${error.message}`);
    }
    
    // For non-Axios errors
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    throw new Error(`Translation failed: ${errorMessage}`);
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
