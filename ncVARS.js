import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';

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
            console.log(`Variables loaded from ${this.filePath}`);
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
