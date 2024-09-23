import chalkAnimation from 'chalk-animation';
import figlet from 'figlet';
import gradient from 'gradient-string';
import {execSync} from 'child_process';
import { GREEN, BLUE, YELLOW } from './color.js';  
import { exec } from 'child_process';
import cliProgress from 'cli-progress';

export { runCommandWithProgress };

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
 * Runs a command with progress tracking.
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

        const process = exec(command);

        let progress = 0;

        process.stdout.on('data', (data) => {
            // Increment progress based on output.
            progress += 10; 
            progressBar.update(progress > total ? total : progress);
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
    clearConsole();

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

    // Simulate fetching status from variables.json and displaying status
    const dockerStatus = '[Docker: Running]';
    const address = '192.168.1.100';
    const ipv4 = '203.0.113.45';
    const version = 'Ubuntu 20.04';
    const name = 'Server 1';
    const psql = 'PostgreSQL 13';
    const psqlStatus = 'Running';
    const redisStatus = '[Redis: Running]';
    const apache2Status = '[Apache: Running]';
    const appUpdates = '[No updates available]';

    // Display status information under the splash screen
    console.log(dockerStatus);
    console.log(BLUE('LAN:'), GREEN(address));
    console.log(BLUE('WAN:'), GREEN(ipv4));
    console.log(BLUE('Ubuntu:'), YELLOW(version), name);
    console.log(BLUE('PostgreSQL'), YELLOW(psql), ':', psqlStatus);
    console.log(BLUE('redis-server:'), redisStatus);
    console.log(BLUE('apache2:'), apache2Status);
    console.log(BLUE('app updates:'), appUpdates);
    console.log('');
}

