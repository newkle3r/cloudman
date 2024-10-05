import fs from 'fs';
import { execSync, spawn } from 'child_process';
import path from 'path';
import { GREEN, BLUE, YELLOW, PURPLE, CYAN, GRAY } from './color.js';
import inquirer from 'inquirer';


class ncUTILS {
    constructor () {
        this.inits = 0;
        
        }
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
            return execSync(command, { encoding: 'utf8' }).toString().trim(); 
        } catch (error) {
            console.error(`Error executing command: ${command}`, error);
            return false; 
        }
    }

    /**
 * Asynchronously fetch the available app updates and core updates.
 */
    async getAvailableUpdates() {
        try {
            const currentVersionOutput = execSync(`sudo -u www-data php /var/www/nextcloud/occ status`, { encoding: 'utf8' });
            const currentVersionMatch = currentVersionOutput.match(/version:\s*([\d.]+)/);
            const currentVersion = currentVersionMatch ? currentVersionMatch[1] : null;
    
            if (!currentVersion) {
                this.appUpdateStatus = RED('Error fetching current Nextcloud version.');
                return;
            }
    
            const output = execSync(`sudo -u www-data php /var/www/nextcloud/occ update:check`, { encoding: 'utf8' });
            let updateSummary = '';
            let coreUpdateText = '';
    
            const coreUpdate = output.match(/Nextcloud\s+(\d+\.\d+\.\d+)\s+is available/);
            if (coreUpdate && this.isVersionHigher(coreUpdate[1], currentVersion)) {
                coreUpdateText = `Nextcloud >> ${coreUpdate[1]}`;
                updateSummary += `${coreUpdateText}\n`;
            }
    
            const appUpdates = output.match(/Update for (.+?) to version (\d+\.\d+\.\d+) is available/g);
            if (appUpdates && appUpdates.length > 0) {
                updateSummary += `${appUpdates.length} app update(s) available.\n`;
            }
    
            if (!coreUpdateText && (!appUpdates || appUpdates.length === 0)) {
                updateSummary = 'No apps or core updates available';
            }
    
            this.appUpdateStatus = GREEN(updateSummary.trim());
        } catch (error) {
            this.appUpdateStatus = RED('Error checking for app updates.');
        }
    }
    
    isVersionHigher(newVersion, currentVersion) {
        const newParts = newVersion.split('.').map(Number);
        const currentParts = currentVersion.split('.').map(Number);
    
        for (let i = 0; i < newParts.length; i++) {
            if (newParts[i] > currentParts[i]) {
                return true;
            } else if (newParts[i] < currentParts[i]) {
                return false;
            }
        }
        return false;
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
            // console.log(`Executing command: ${command}`);
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
        this.inits ++;
        // console.log(`Numbers of times init has ran ${this.inits}`);
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
 * Gets the size of a file in kilobytes by sending a HEAD request to the server.
 * @param {string} url - The URL of the file to check.
 * @returns {Promise<number>} - The size of the file in kilobytes.
 */
async getFileSize(url) {
    return new Promise((resolve, reject) => {
        const curl = spawn('curl', ['-sI', url]);

        let headers = '';
        curl.stdout.on('data', (data) => {
            headers += data.toString();
        });

        curl.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(`Failed to get file size. curl exited with code ${code}`));
            }

            const contentLength = headers.match(/Content-Length: (\d+)/i);
            if (contentLength) {
                const sizeInBytes = parseInt(contentLength[1], 10);
                resolve(Math.ceil(sizeInBytes / 1024)); // Convert to kilobytes
            } else {
                reject(new Error('Content-Length header not found.'));
            }
        });

        curl.on('error', (error) => {
            reject(error);
        });
    });
}

    /**
     * Spawns a command with real-time progress handling.
     * @param {string} command - The command to run.
     * @param {array} args - Arguments for the command.
     * @returns {ChildProcess} - The spawned child process.
     */
    spawnCommandWithProgress(command, args = []) {
        return spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    }

    /**
     * Checks free space and returns the available space in GB.
     */
    checkFreeSpace() {
        const freeSpace = this.runCommand("df -h / | grep -m 1 '/' | awk '{print $4}'");
        return parseInt(freeSpace.replace('G', ''), 10); // Return free space in GB
    }

    /**
     * Generate a random password based on the provided length and charset.
     * @param {number} length - The desired length of the password.
     * @param {string} charset - The set of characters to use in the password.
     * @returns {string} - The generated password.
     */
    genPasswd(length, charset = 'a-zA-Z0-9@#*') {
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
     * Prompts user to press Enter to continue.
     */
    async awaitContinue() {
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
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
                new Promise(resolve => setTimeout(resolve, 30000)); // 30 sec
            }
        }
    }

    /**
     * Run Nextcloud occ command
     * @param {string} command - The occ command to run (e.g., 'config:system:set memcache.local --value="\OC\Memcache\Redis"')
     */
    runOccCommand(command) {
        try {
            execSync(`sudo -u www-data php ${this.NCPATH}/occ ${command}`, { stdio: 'inherit' });
            console.log(`Successfully ran: ${command}`);
        } catch (error) {
            console.error(`Failed to run: ${command}`, error.message);
        }
    }

    /**
     * Add aliases to /root/.bash_aliases if they do not exist.
     */
    addAliases() {
        const aliasFile = '/root/.bash_aliases';
        const nextcloudAlias = "alias nextcloud_occ='sudo -u www-data php /var/www/nextcloud/occ'";
        const updateAlias = "alias run_update_nextcloud='bash /var/scripts/update.sh'";

        try {
            if (fs.existsSync(aliasFile)) {
                const aliases = fs.readFileSync(aliasFile, 'utf8');

                if (!aliases.includes('nextcloud')) {
                    fs.appendFileSync(aliasFile, `\n${nextcloudAlias}\n${updateAlias}\n`);
                    console.log(GREEN('Aliases added to /root/.bash_aliases'));
                } else {
                    console.log(GREEN('Aliases already present in /root/.bash_aliases'));
                }
            } else {
                // If /root/.bash_aliases doesn't exist, create the file and add the aliases
                fs.writeFileSync(aliasFile, `${nextcloudAlias}\n${updateAlias}\n`);
                console.log(GREEN('/root/.bash_aliases created and aliases added'));
            }

            execSync('source /root/.bash_aliases', { stdio: 'inherit' });
        } catch (error) {
            console.error(RED('Error managing /root/.bash_aliases:'), error);
        }
    }

    /**
     * Installs a program if it's not already installed.
     * @param {string} program - The name of the program to install.
     */
    installIfNot(program) {
        try {

            const isInstalled = execSync(`dpkg-query -W -f='${Status}' ${program} | grep -q "ok installed"`, { stdio: 'pipe' });

            if (!isInstalled) {
                console.log(`${program} is not installed. Installing...`);

                execSync('sudo apt-get update -q4', { stdio: 'inherit' });  
                execSync(`sudo RUNLEVEL=1 apt-get install ${program} -y`, { stdio: 'inherit' }); 
                
                console.log(`${program} installed successfully.`);
            } else {
                console.log(`${program} is already installed.`);
            }
        } catch (error) {
            console.error(`Failed to check or install ${program}:`, error);
        }
    }
    /**
     * Checks if a program is installed.
     * @param {string} program - The name of the program to check.
     * @returns {boolean} - Returns true if the program is installed, false otherwise.
     */
    isProgramInstalled(program) {
        try {
            execSync(`dpkg-query -W -f='${Status}' ${program} | grep -q "ok installed"`, { stdio: 'ignore' });
            return true; 
        } catch (error) {
            return false; 
        }
    }
}

export default ncUTILS;
