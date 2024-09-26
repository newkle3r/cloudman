import fs from 'fs';
import { execSync, spawn } from 'child_process';
import path from 'path';
import inquirer from 'inquirer';
import chalkAnimation from 'chalk-animation';
import gradient from 'gradient-string';
import figlet from 'figlet';
import { GREEN, BLUE, YELLOW, PURPLE, CYAN, GRAY } from './color.js';

class ncUTILS {
    /**
     * Clears the console screen.
     */
    clearConsole() {
        console.clear();
    }

    /**
     * Checks the execution of a command and returns its output.
     * @param {string} command - The shell command to execute.
     * @returns {string|boolean} - The command's output if successful, false if there was an error.
     */
    checkComponent(command) {
        try {
            return execSync(command, { encoding: 'utf8' }).toString().trim(); // Return output of command
        } catch (error) {
            console.error(`Error executing command: ${command}`, error);
            return false; 
        }
    }

    /**
     * Helper function to extract configuration values from the config.php file
     * @param {string} key - The key to look for (e.g., 'dbname')
     * @returns {string} - The value corresponding to the key
     */
    getConfigValue(key, NCPATH) {
        try {
            const configPath = `${NCPATH}/config/config.php`;
            const command = `sudo grep -Po "(?<=['\\"]${key}['\\"] => ['\\"]).*?(?=['\\"])" ${configPath}`;
            return this.runCommand(command).trim();
        } catch (error) {
            console.error(`Error fetching config value for ${key}:`, error);
            return null;
        }
    }

    /**
     * Load variables from the JSON file.
     */
    loadVariables() {
        try {
            const data = fs.readFileSync('./variables.json', 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading variables.json:', error);
            return {};
        }
    }

    /**
     * Executes a shell command and returns the output as a string.
     * @param {string} command - The command to execute.
     * @returns {string} - The command's output as a string.
     */
    runCommand(command) {
        try {
            console.log(`Executing command: ${command}`);
            return execSync(command, { shell: '/bin/bash' }).toString().trim();
        } catch (error) {
            console.error(`Error executing command: ${command}`, error);
            return '';
        }
    }

    /**
     * Generalized initialization function to fetch updates/statuses.
     * @param {function} fetchFunction - The function to call for fetching updates.
     * @param {string} lastCheckKey - A unique key to track the last update check.
     * @param {object} context - The class instance to store timestamps.
     * @param {number} threshold - The time threshold (in milliseconds) to determine if an update is needed.
     */
    async initialize(fetchFunction, lastCheckKey, context, threshold) {
        const now = new Date().getTime();
        if (!context[lastCheckKey] || now - context[lastCheckKey] > threshold) {
            await fetchFunction();
            context[lastCheckKey] = now;
        }
    }

    /**
     * Runs a command with progress tracking, useful for commands like `curl` that output progress.
     * @param {string} command - The command to run.
     * @param {array} args - Arguments for the command.
     * @returns {Promise<void>} - Resolves when the command is complete.
     */
    runCommandWithProgress(command, args = []) {
        return new Promise((resolve, reject) => {
            const process = spawn(command, args, { stdio: 'inherit' });

            process.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Command failed with exit code ${code}`));
                }
            });

            process.on('error', (error) => {
                reject(error);
            });
        });
    }

    

    /**
     * Generate a random password based on the provided length and charset.
     * @param {number} length - The desired length of the password.
     * @param {string} charset - The set of characters to use in the password.
     * @returns {string} - The generated password.
     */
    gen_passwd(length, charset = 'a-zA-Z0-9@#*') {
        let password = '';
        const charsetArray = charset.split('');
        const charsetLength = charsetArray.length;

        while (password.length < length) {
            const randomIndex = Math.floor(Math.random() * charsetLength);
            password += charsetArray[randomIndex];
        }

        return password;
    }

    /**
     * Function to download a file using curl to a specific directory.
     * 
     * @param {string} url - The base URL of the file to download (e.g., "https://example.com").
     * @param {string} filename - The name of the file to download (e.g., "myfile.txt").
     * @param {string} directory - The destination directory to store the file.
     * @param {number} maxRetries - Maximum number of retry attempts (default is 10).
     */
    curlToDir(url, filename, directory, maxRetries = 10) {
        // Ensure the directory exists
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }

        const filePath = path.join(directory, filename);

        // Remove the existing file if it exists
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        let retries = 0;

        while (retries < maxRetries) {
            try {
                console.log(`Attempting to download ${url}/${filename}...`);
                execSync(`curl -sfL ${url}/${filename} -o ${filePath}`);
                console.log(`File downloaded successfully to ${filePath}`);
                break; 
            } catch (error) {
                retries += 1;
                console.error(`Failed to download ${url}/${filename} (Attempt ${retries} of ${maxRetries})`);

                if (retries >= maxRetries) {
                    console.error(`Exceeded maximum retries (${maxRetries}). Exiting...`);
                    throw new Error(`Failed to download ${url}/${filename} after ${maxRetries} attempts.`);
                }

                console.log(`Retrying in 30 seconds...`);
                new Promise(resolve => setTimeout(resolve, 30000)); // 30 second delay
            }
        }
    }
}

export default new ncUTILS();
