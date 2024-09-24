import chalkAnimation from 'chalk-animation';
import figlet from 'figlet';
import gradient from 'gradient-string';
import {execSync} from 'child_process';
import { GREEN, BLUE, YELLOW, PURPLE } from './color.js';  
import { exec } from 'child_process';
import cliProgress from 'cli-progress';



/**
 * Clears the console screen.
 */
export function clearConsole() {
    console.clear();
}

/**
 * Checks the execution of a command and returns its output.
 * @param {string} command - The shell command to execute.
 * @returns {string|boolean} - The command's output if successful, false if there was an error.
 */
export function checkComponent(command) {
    try {
        return execSync(command, { encoding: 'utf8' }).toString().trim(); // Return output of command
    } catch (error) {
        console.error(`Error executing command: ${command}`, error);
        return false; 
    }
}


export function loadVariables() {
    try {
        const data = fs.readFileSync('./variables.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading variables.json:', error);
        return {};
    }
}

/**
 * Generalized initialization function to fetch updates/statuses
 * @param {function} fetchFunction - The function to call (e.g. getAvailableUpdates) for fetching updates.
 * @param {string} lastCheckKey - A unique key to track the last time this specific update was fetched.
 * @param {object} context - The context (like the class instance) to store lastCheck timestamps.
 * @param {number} threshold - The time threshold (in milliseconds) to determine if an update is needed.
 */
export const UPDATE_THRESHOLD = 60000;

export async function initialize(fetchFunction, lastCheckKey, context) {
    const now = new Date().getTime();
    
    if (!context[lastCheckKey] || now - context[lastCheckKey] > threshold) {
        await fetchFunction();
        context[lastCheckKey] = now; 
    }
}


/**
 * Runs a command with progress tracking, specifically for commands like `curl` that output progress on `stderr`.
 * @param {string} command - The command to run.
 * @param {number} [total=100] - The total amount for progress bar.
 * @returns {Promise<void>} - Resolves when the command is done.
 */
export function runCommandWithProgress(command, total = 100) {
    return new Promise((resolve, reject) => {
        const progressBar = new cliProgress.SingleBar({
            format: 'Progress [{bar}] {percentage}% | ETA: {eta}s | {value}/{total}'
        }, cliProgress.Presets.shades_classic);

        progressBar.start(total, 0);

        let progress = 0;
        const process = exec(command);

        process.stderr.on('data', (data) => {
            // Parse `curl`'s progress output
            const match = data.toString().match(/([0-9]+)%/);
            if (match && match[1]) {
                progress = parseInt(match[1], 10);
                progressBar.update(progress > total ? total : progress);
            }
        });

        process.on('close', (code) => {
            progressBar.stop();
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with exit code ${code}`));
            }
        });

        process.on('error', (error) => {
            progressBar.stop();
            reject(error);
        });
    });
}

/**
 * For index.js
 * Displays the welcome splash screen with system information.
 */
export async function welcome() {
    const linkText = 'Want a professional to just fix it for you? Click here!';
    const url = 'https://shop.hanssonit.se/product-category/support/';
    clearConsole();
    console.log(`\x1B]8;;${url}\x07${PURPLE(linkText)}\x1B]8;;\x07`);

    const rainbowTitle = chalkAnimation.rainbow(
        'Nextcloud instance manager by T&M Hansson IT \n'
    );
    
    await new Promise((resolve) => setTimeout(resolve, 1000));
    rainbowTitle.stop();

    console.log(
        gradient.pastel.multiline(
            figlet.textSync('Cloudman', { horizontalLayout: 'full' })
        )
    );
}
