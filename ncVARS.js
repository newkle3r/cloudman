import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';
import { RED,GREEN,BLUE,YELLOW,PURPLE } from './color.js';


/**
 * Class to manage Nextcloud configuration variables.
 * Provides functionality to load, save, and update system variables in variables.json.
 */
class ncVARS {
    constructor(filePath = './variables.json') {
        this.filePath = filePath;
        this.loadVariables(); // Load variables from file during initialization

        // Default directories and paths
        this.SCRIPTS = '/var/scripts';
        this.HTML = '/var/www';
        this.NCPATH = `${this.HTML}/nextcloud`;
        this.POOLNAME = 'ncdata';
        this.NCDATA = `/mnt/${this.POOLNAME}`;
        this.SNAPDIR = '/var/snap/spreedme';
        this.GPGDIR = '/tmp/gpg';
        this.SHA256_DIR = '/tmp/sha256';
        this.BACKUP = '/mnt/NCBACKUP';
        this.NC_APPS_PATH = `${this.NCPATH}/apps`;
        this.VMLOGS = '/var/log/nextcloud';
        this.PSQLVER = this.getCommandOutput('psql --version');

        // Ubuntu OS information
        this.DISTRO = this.getCommandOutput('lsb_release -sr');
        this.CODENAME = this.getCommandOutput('lsb_release -sc');
        this.KEYBOARD_LAYOUT = this.getCommandOutput("localectl status | grep 'Layout' | awk '{print $3}'");

        // System vendor and networking
        this.SYSVENDOR = this.getCommandOutput('cat /sys/devices/virtual/dmi/id/sys_vendor');
        this.IFACE = this.getCommandOutput("ip r | grep 'default via' | awk '{print $5}'");
        this.IFACE2 = this.getCommandOutput("ip -o link show | awk '{print $2,$9}' | grep 'UP' | cut -d ':' -f 1");
        this.REPO = this.getCommandOutput("grep '^deb ' /etc/apt/sources.list | grep http | awk '{print $2}' | head -1");
        this.ADDRESS = this.getCommandOutput('hostname -I | cut -d " " -f 1');
        this.WANIP4 = this.getCommandOutput('curl -s -k -m 5 -4 https://api64.ipify.org');
        this.INTERFACES = '/etc/netplan/nextcloud.yaml';
        this.GATEWAY = this.getCommandOutput("ip route | grep default | awk '{print $3}'");

            // Extract the PostgreSQL status or set to 'disabled' if empty
        
        let postgresqlStatus;
        try {
            postgresqlStatus = execSync("systemctl status postgresql | grep Active | awk '{print $2}'").toString().trim();
            if (!postgresqlStatus) {
                postgresqlStatus = 'disabled';  // Set to 'disabled' if status is empty
            }
        } catch (error) {
            postgresqlStatus = 'disabled';  // Set to 'disabled' in case of an error (e.g., service not found)
        }
        
        this.psqlStatus = YELLOW(postgresqlStatus) === 'active' ? RED(postgresqlStatus) : GREEN(postgresqlStatus);


        let redisStatus;
        try {
            redisStatus = execSync("systemctl status redis-server | grep Active | awk '{print $2}'").toString().trim();
            if (!redisStatus) {
                redisStatus = 'disabled';  // Set to 'disabled' if status is empty
            }
        } catch (error) {
            redisStatus = 'disabled';  // Set to 'disabled' in case of an error (e.g., service not found)
        }
        this.redisStatus = YELLOW(redisStatus) === 'active' ? RED(redisStatus) : GREEN(redisStatus);



        let apache2Status;
        try {
            apache2Status = execSync("systemctl status apache2 | grep Active | awk '{print $2}'").toString().trim();
            if (!apache2Status) {
                apache2Status = 'disabled';  // Sätt till 'disabled' om statusen är tom
            }
        } catch (error) {
            apache2Status = 'disabled';  // Sätt till 'disabled' om det uppstår ett fel (t.ex. tjänsten hittas inte)
        }
        this.apache2Status = apache2Status === 'active' ? GREEN(apache2Status) : RED(apache2Status);

        


        let dockerStatus;

        try {
            // List active containers with their names and ports
            const containerInfo = execSync("docker ps --format '{{.Names}} {{.Ports}}'").toString().trim();

            if (containerInfo) {
                // Process each container's information
                const containers = containerInfo.split('\n').map(container => {
                    const [name, ports] = container.split(' ');
                    
                    // Simplify the container name by taking the first part before '_' or '-'
                    const simplifiedName = name.split(/[_-]/)[0];

                    // Fetch IP address of the container (without coloring in execSync command)
                    const ipInfo = execSync(`docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${name}`).toString().trim();

                    // Return colored information for name, ip, and ports
                    return { name: PURPLE(simplifiedName), ip: ipInfo, ports };
                });

                // Format the result for all containers
                dockerStatus = containers.map(container => {
                    return `${BLUE('Container:')} ${PURPLE(container.name)}, ${BLUE('IP:')} ${GREEN(container.ip)}, ${BLUE('Ports:')} ${GREEN(container.ports)}`;
                }).join('\n');
            } else {
                dockerStatus = 'No active containers';  // If no containers are running
            }
        } catch (error) {
            console.error('Error while fetching Docker containers:', error.message);  // Log the error for debugging
            dockerStatus = PURPLE('Docker is not running or an error occurred');  // Handle error
        }

        // Store dockerStatus for later use
        this.dockerStatus = dockerStatus;

 



                

        let appUpdateStatus;

        try {
            // Fetch list of apps from the Nextcloud OCC command
            const appListOutput = execSync("sudo -u www-data php /var/www/nextcloud/occ app:list").toString().trim();
            
            // Use regex to find apps that need updates (this assumes a specific output format)
            const updatesAvailable = appListOutput.match(/(\w+):\s*update available/gi) || [];
        
            // Count how many apps have updates available
            const updateCount = updatesAvailable.length;
        
            // If there are updates, format the status
            if (updateCount > 0) {
                // Extract app names from the match results
                const appNames = updatesAvailable.map(line => line.split(':')[0]).join(', ');
                appUpdateStatus = GREEN(`There are ${updateCount} apps with updates: ${appNames}`);  // Success message in green
            } else {
                appUpdateStatus = YELLOW('No apps have available updates');  // Message for no updates
            }
        } catch (error) {
            appUpdateStatus = RED('Error fetching app updates or no apps available');  // Error message in red
        }
        
        // Output or store the app update status
        console.log(appUpdateStatus);
        this.appUpdateStatus = appUpdateStatus;

                    


                

        // Let's encrypt - TLS cert
        
/*
        "DEDYNDOMAIN": "The domain name used for TLS activation.",
        "TLSDOMAIN": "The domain to be set for the Nextcloud TLS configuration.",
        "TLS_CONF": "TLS configuration file.",
        "HTTP_CONF": "HTTP configuration file.",
        "PHPVER": "Current PHP version in use for Apache conf file.",
        "CERTFILES": "Directory where SSL certificates are stored.",
        "DHPARAMS_TLS": "DHParams file for TLS configuration.",
        "SETENVPROXY": "SetEnv proxy-sendcl variable for specific Ubuntu versions.",
        "DEDYNPORT": "Custom port for public access if the user decides to change it."

*/
        this.redis = execSync("systemctl status redis | grep Active | awk '{print $2, $3}'").toString().trim();

        // DNS and ports
        this.INTERNET_DNS = '9.9.9.9';
        this.DNS1 = '9.9.9.9';
        this.DNS2 = '149.112.112.112';
        this.NONO_PORTS = [
            22, 25, 53, 80, 443, 1024, 3012, 3306, 5178, 5179,
            5432, 7867, 7983, 8983, 10000, 8081, 8443, 9443, 9000, 9980, 9090, 9200, 9600, 1234
        ];
    }

    /**
     * Helper function to execute a shell command and return the output.
     * @param {string} command - The shell command to run.
     * @returns {string} - Output from the command.
     */
    getCommandOutput(command) {
        try {
            return execSync(command).toString().trim();
        } catch (error) {
            console.error(`Error executing command: ${command}`);
            return '';
        }
    }

    /**
     * Save the current variables to the JSON file.
     */
    saveVariables() {
        try {
            const data = JSON.stringify(this, null, 2);
            fs.writeFileSync(this.filePath, data, 'utf8');
            console.log(`Variables saved to ${this.filePath}`);
        } catch (error) {
            console.error(`Error saving variables to ${this.filePath}:`, error);
        }
    }

    /**
     * Load variables from the JSON file and update class properties.
     */
    loadVariables() {
        if (fs.existsSync(this.filePath)) {
            const data = fs.readFileSync(this.filePath, 'utf8');
            const loadedVars = JSON.parse(data);
            Object.assign(this, loadedVars);
            // console.log(`Variables loaded from ${this.filePath}`);
        } else {
            console.error(`File not found: ${this.filePath}`);
        }
    }

    /**
     * Update a specific variable in the JSON and class property.
     * @param {string} key - The variable name to update.
     * @param {any} value - The new value to set for the variable.
     */
    updateVariable(key, value) {
        this[key] = value;
        this.saveVariables();
        console.log(`Updated ${key} to ${value}`);
    }

    /**
     * Print the current variables to the console.
     */
    printVariables() {
        console.log('Current Nextcloud Variables:', this);
    }

    /**
     * Update the SMTP configuration in variables.json.
     * @param {string} mailServer - The SMTP server address.
     * @param {string} protocol - The encryption protocol (SSL, STARTTLS, NO-ENCRYPTION).
     * @param {string} smtpPort - The port used for the SMTP connection.
     * @param {string} mailUsername - The username for the SMTP server.
     * @param {string} mailPassword - The password for the SMTP server.
     * @param {string} recipient - The recipient email address for sending emails.
     */
    updateSMTP(mailServer, protocol, smtpPort, mailUsername, mailPassword, recipient) {
        this.updateVariable('MAIL_SERVER', mailServer);
        this.updateVariable('PROTOCOL', protocol);
        this.updateVariable('SMTP_PORT', smtpPort);
        this.updateVariable('MAIL_USERNAME', mailUsername);
        this.updateVariable('MAIL_PASSWORD', mailPassword);
        this.updateVariable('RECIPIENT', recipient);
    }

    /**
     * Update the Redis configuration in variables.json.
     * @param {string} redisSock - The Redis Unix socket file location.
     * @param {string} redisConf - The Redis configuration file location.
     * @param {string} redisPass - The password for Redis.
     */
    updateRedis(redisSock, redisConf, redisPass) {
        this.updateVariable('REDIS_SOCK', redisSock);
        this.updateVariable('REDIS_CONF', redisConf);
        this.updateVariable('REDIS_PASS', redisPass);
    }

    /**
     * Generate a random password of a given length using the provided charset.
     * @param {number} length - The length of the password.
     * @param {string} charset - The characters to use in the password.
     * @returns {string} - The generated password.
     */
    genPasswd(length, charset) {
        let password = '';
        while (password.length < length) {
            const randomChar = execSync(`head -c 100 /dev/urandom | LC_ALL=C tr -dc "${charset}"`).toString().trim();
            password += randomChar.slice(0, length - password.length);
        }
        return password;
    }
}

export default ncVARS;
