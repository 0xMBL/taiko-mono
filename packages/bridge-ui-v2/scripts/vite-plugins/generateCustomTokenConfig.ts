import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import path from 'path';
import { Project, SourceFile, VariableDeclarationKind } from 'ts-morph';

import configuredChainsSchema from '../../config/schemas/configuredChains.schema.json';
import type { Token } from '../../src/libs/token/types';
import { decodeBase64ToJson } from './../utils/decodeBase64ToJson';
import { formatSourceFile } from './../utils/formatSourceFile';
import { PluginLogger } from './../utils/PluginLogger';
import { validateJsonAgainstSchema } from './../utils/validateJson';

dotenv.config();
const pluginName = 'generateTokens';
const logger = new PluginLogger(pluginName);

const skip = process.env.SKIP_ENV_VALDIATION === 'true';

const currentDir = path.resolve(new URL(import.meta.url).pathname);

const outputPath = path.join(path.dirname(currentDir), '../../src/generated/customTokenConfig.ts');

export function generateCustomTokenConfig() {
  return {
    name: pluginName,
    async buildStart() {
      logger.info('Plugin initialized.');
      let configuredTokenConfigFile;

      if (skip) {
        configuredTokenConfigFile = '';
      } else {
        if (!process.env.CONFIGURED_CUSTOM_TOKENS) {
          throw new Error(
            'CONFIGURED_CUSTOM_TOKENS is not defined in environment. Make sure to run the export step in the documentation.',
          );
        }

        // Decode base64 encoded JSON string
        configuredTokenConfigFile = decodeBase64ToJson(process.env.CONFIGURED_CUSTOM_TOKENS || '');

        // Valide JSON against schema
        const isValid = validateJsonAgainstSchema(configuredTokenConfigFile, configuredChainsSchema);

        if (!isValid) {
          throw new Error('encoded configuredBridges.json is not valid.');
        }
      }
      const tsFilePath = path.resolve(outputPath);

      const project = new Project();
      const notification = `// Generated by ${pluginName} on ${new Date().toLocaleString()}`;
      const warning = `// WARNING: Do not change this file manually as it will be overwritten`;

      let sourceFile = project.createSourceFile(tsFilePath, `${notification}\n${warning}\n`, { overwrite: true });

      // Create the TypeScript content
      sourceFile = await storeTypes(sourceFile);
      sourceFile = await buildCustomTokenConfig(sourceFile, configuredTokenConfigFile);

      await sourceFile.save();

      const formatted = await formatSourceFile(tsFilePath);

      // Write the formatted code back to the file
      await fs.writeFile(tsFilePath, formatted);
      logger.info(`Formatted config file saved to ${tsFilePath}`);
    },
  };
}

async function storeTypes(sourceFile: SourceFile) {
  logger.info(`Storing types...`);
  sourceFile.addImportDeclaration({
    namedImports: ['Token'],
    moduleSpecifier: '$libs/token',
    isTypeOnly: true,
  });

  sourceFile.addImportDeclaration({
    namedImports: ['TokenType'],
    moduleSpecifier: '$libs/token',
  });
  logger.info('Type stored.');
  return sourceFile;
}

async function buildCustomTokenConfig(sourceFile: SourceFile, configuredTokenConfigFile: Token[]) {
  logger.info('Building custom token config...');
  if (skip) {
    sourceFile.addVariableStatement({
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: 'customToken',
          initializer: '[]',
          type: 'Token[]',
        },
      ],
      isExported: true,
    });
    logger.info(`Skipped token.`);
  } else {
    const tokens: Token[] = configuredTokenConfigFile;

    sourceFile.addVariableStatement({
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: 'customToken',
          initializer: _formatObjectToTsLiteral(tokens),
          type: 'Token[]',
        },
      ],
      isExported: true,
    });
    logger.info(`Configured ${tokens.length} tokens.`);
  }

  return sourceFile;
}

const _formatObjectToTsLiteral = (tokens: Token[]): string => {
  const formatToken = (token: Token): string => {
    const entries = Object.entries(token);
    const formattedEntries = entries.map(([key, value]) => {
      if (key === 'type' && typeof value === 'string') {
        return `${key}: TokenType.${value}`;
      }
      if (typeof value === 'object') {
        return `${key}: ${JSON.stringify(value)}`;
      }
      return `${key}: ${JSON.stringify(value)}`;
    });

    return `{${formattedEntries.join(', ')}}`;
  };

  return `[${tokens.map(formatToken).join(', ')}]`;
};
