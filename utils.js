import chalkAnimation from 'chalk-animation';
import figlet from 'figlet';
import gradient from 'gradient-string';
import { GREEN, BLUE, YELLOW } from './color.js';  

/**
 * Clears the console screen.
 */
export function clearConsole() {
    console.clear();
}
// dublett, ska bort
export async function checkComponent(command) {
    try {
        execSync(command);
        return true; 
    } catch (error) {
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

