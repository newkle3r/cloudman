import fs from 'fs';
import { execSync } from 'child_process';
import { RED, GREEN, BLUE, YELLOW, PURPLE } from './color.js';
import { initialize } from './utils.js';

/**
 * Class to manage Nextcloud configuration variables.
 * Provides functionality to load, save, and update system variables in variables.json.
 */
class ncVARS {
    constructor(filePath = './variables.json') {
        this.filePath = filePath;
        this.lastAppUpdateCheck = null;
        this.appUpdateStatus = null;

        // Load variables from file during initialization
        this.loadVariables();

        // Fetch statuses
        this.psqlStatus = this.getServiceStatus('postgresql');
        this.redisStatus = this.getServiceStatus('redis-server');
        this.apache2Status = this.getServiceStatus('apache2');
        this.dockerStatus = this.getDockerStatus();

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

        // Domain and TLS configuration
        this.DEDYNDOMAIN = this.getCommandOutput("hostname -f");
        this.TLSDOMAIN = this.getCommandOutput("hostname -f");
        this.TLS_CONF = `/etc/apache2/sites-available/${this.TLSDOMAIN}.conf`;
        this.HTTP_CONF = `/etc/apache2/sites-available/${this.DEDYNDOMAIN}.conf`;
        this.PHPVER = this.getCommandOutput("php -v | grep '^PHP' | awk '{print $2}'");
        this.CERTFILES = this.getCommandOutput("sudo certbot certificates | grep -i 'Certificate Path' | awk '{print $3}'");
        this.DHPARAMS_TLS = '/etc/ssl/certs/dhparam.pem';
        this.SETENVPROXY = 'proxy-sendcl';
        this.DEDYNPORT = '443';
    }

    async manageVars() {
        // Initialize and fetch updates if necessary
        await initialize(this.getAvailableUpdates, 'lastAppUpdateCheck', this);
       
    }

   

    /**
     * Asynchronously fetch the available app updates.
     */
    async getAvailableUpdates() {
        try {
            // Fetch list of apps from the Nextcloud OCC command
            const appListOutput = execSync("sudo -u www-data php /var/www/nextcloud/occ app:list").toString().trim();
            
            // Use regex to find apps that need updates
            const updatesAvailable = appListOutput.match(/(\w+):\s*update available/gi) || [];
        
            // Count how many apps have updates available
            const updateCount = updatesAvailable.length;

            if (updateCount > 0) {
                const appNames = updatesAvailable.map(line => line.split(':')[0]).join(', ');
                this.appUpdateStatus = GREEN(`There are ${updateCount} apps with updates: ${appNames}`);
            } else {
                this.appUpdateStatus = YELLOW('No apps have available updates');
            }
        } catch (error) {
            this.appUpdateStatus = RED('Error fetching app updates or no apps available');
        }
    }



    /**
     * Fetch the status of a system service like PostgreSQL, Redis, or Apache.
     * @param {string} service - The name of the service (e.g., 'postgresql', 'redis-server').
     * @returns {string} - Formatted service status.
     */
    getServiceStatus(service) {
        let status;
        try {
            status = execSync(`systemctl status ${service} | grep Active | awk '{print $2}'`).toString().trim();
            if (!status) {
                status = 'disabled';
            }
        } catch (error) {
            status = 'disabled';
        }
        return status === 'active' ? GREEN(status) : RED(status);
    }

    /**
     * Fetch Docker container status and format the output.
     */
    getDockerStatus() {
        let dockerStatus;
        try {
            const containerInfo = execSync("docker ps --format '{{.Names}} {{.Ports}}'").toString().trim();
            if (containerInfo) {
                const containers = containerInfo.split('\n').map(container => {
                    const [name, ports] = container.split(' ');
                    const simplifiedName = name.split(/[_-]/)[0];
                    const ipInfo = execSync(`docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${name}`).toString().trim();
                    return { name: PURPLE(simplifiedName), ip: ipInfo, ports };
                });
                dockerStatus = containers.map(container => {
                    return `${BLUE('Container:')} ${PURPLE(container.name)}, ${BLUE('IP:')} ${GREEN(container.ip)}, ${BLUE('Ports:')} ${GREEN(container.ports)}`;
                }).join('\n');
            } else {
                dockerStatus = 'No active containers';
            }
        } catch (error) {
            dockerStatus = PURPLE('Docker is not running or an error occurred');
        }
        return dockerStatus;
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
            const properties = Object.keys(this).reduce((acc, key) => {
                if (typeof this[key] !== 'function') {
                    acc[key] = this[key];
                }
                return acc;
            }, {});
            const data = JSON.stringify(properties, null, 2);
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
            try {
                const data = fs.readFileSync(this.filePath, 'utf8');
                const loadedVars = JSON.parse(data);
                Object.keys(loadedVars).forEach(key => {
                    if (typeof loadedVars[key] !== 'function') {
                        this[key] = loadedVars[key];
                    }
                });
                console.log(`Variables loaded from ${this.filePath}`);
            } catch (error) {
                console.error(`Error loading variables from ${this.filePath}:`, error);
            }
        } else {
            console.error(`File not found: ${this.filePath}`);
        }
    }

    /**
     * Update a specific variable in the JSON and class property.
     * Only data properties will be updated, excluding functions.
     * @param {string} key - The variable name to update.
     * @param {any} value - The new value to set for the variable.
     */
    updateVariable(key, value) {
        if (typeof this[key] !== 'function') {
            this[key] = value;  // Update the in-memory value
            this.saveVariables();  // Save the updated variables back to the file
            console.log(`Updated ${key} to ${value}`);
        } else {
            console.error(`Cannot update '${key}' because it is a method, not a variable.`);
        }
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
