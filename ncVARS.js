// ncVARS.js
import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';

/**
 * Class to manage Nextcloud configuration variables.
 * Provides functionality to load, save, and access system variables.
 */
class ncVARS {
    constructor() {
        // Directories and paths
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

        /**
         * Retrieves the Ubuntu distribution version (e.g., "20.04" or "18.04").
         * The `lsb_release -sr` command outputs the version number of the current OS.
         *
         * |- lsb_release
         * L - -sr (release short)
         *                  |{output}| -> e.g., "20.04"
         */
        this.DISTRO = this.getCommandOutput('lsb_release -sr');
        
        /**
         * Retrieves the Ubuntu codename (e.g., "focal" for Ubuntu 20.04 or "bionic" for Ubuntu 18.04).
         * The `lsb_release -sc` command outputs the codename of the current OS.
         *
         * |- lsb_release
         * L - -sc (short codename)
         *                  |{output}| -> e.g., "focal"
         */
        this.CODENAME = this.getCommandOutput('lsb_release -sc');
        
        /**
         * Retrieves the current keyboard layout (e.g., "us", "gb", or "se").
         * The `localectl status` command outputs system locale and keyboard settings.
         * The command is piped through `grep` to isolate the line containing the layout,
         * and `awk '{print $3}'` extracts the third field, which is the keyboard layout.
         *
         * |- localectl
         *    |- grep "Layout"
         *        L - awk '{print $3}'
         *                      |{$1: "VC"}|{$2: "Keymap"}|{$3: "us"}|
         *                                             |output -> "us"|
         */
        this.KEYBOARD_LAYOUT = this.getCommandOutput("localectl status | grep 'Layout' | awk '{print $3}'");
        
        // System vendor and networking
        
        /**
         * Retrieves the system vendor information.
         * The `/sys/devices/virtual/dmi/id/sys_vendor` file contains the manufacturer of the system.
         * 
         * |- cat
         *    L - /sys/devices/virtual/dmi/id/sys_vendor
         *                |{output}| -> e.g., "Dell Inc.", "Hewlett-Packard"
         */
        this.SYSVENDOR = this.getCommandOutput('cat /sys/devices/virtual/dmi/id/sys_vendor');
        
        /**
         * Retrieves the primary network interface used for the default route.
         * The `ip r` command lists routing table information.
         * The `grep 'default via'` isolates the line containing the default route,
         * and `awk '{print $5}'` extracts the fifth field, which is the network interface (e.g., "eth0").
         *
         * |- ip r
         *    |- grep "default via"
         *       L - awk '{print $5}'
         *                      |{$1}|{$2}|{$3}|{$4}|{$5}|{$6}|
         *                      |"default"|"via"|"192.168.1.1"|"dev"|"eth0"|
         *                                             |output -> "eth0"|
         */
        this.IFACE = this.getCommandOutput("ip r | grep 'default via' | awk '{print $5}'");
        
        /**
         * Retrieves the secondary interface that is up and running.
         * The `ip -o link show` command lists all network interfaces with their statuses.
         * The command uses `awk` to print the second field (interface name) and ninth field (state),
         * and `grep 'UP'` filters interfaces that are up. `cut -d ':' -f 1` isolates the interface name.
         *
         * |- ip -o link show
         *    |- awk '{print $2, $9}' 
         *        |- grep "UP"
         *           |- cut -d ':' -f 1
         *                         |output -> e.g., "eth1"|
         */
        this.IFACE2 = this.getCommandOutput("ip -o link show | awk '{print $2,$9}' | grep 'UP' | cut -d ':' -f 1");
        
        /**
         * Retrieves the first repository URL from the `/etc/apt/sources.list` file.
         * The `grep '^deb '` command filters lines that start with "deb" (defining repositories),
         * `grep http` ensures that the URL uses HTTP, and `awk '{print $2}'` extracts the second field (the URL).
         * The `head -1` limits the result to the first match (e.g., "http://archive.ubuntu.com/ubuntu").
         *
         * |- grep '^deb ' /etc/apt/sources.list
         *    |- grep 'http'
         *       |- awk '{print $2}'
         *          |- head -1
         *                         |output -> e.g., "http://archive.ubuntu.com/ubuntu"|
         */
        this.REPO = this.getCommandOutput("grep '^deb ' /etc/apt/sources.list | grep http | awk '{print $2}' | head -1");
        
        /**
         * Retrieves the current local IP address of the machine.
         * The `hostname -I` command outputs all IP addresses assigned to the machine.
         * The `cut -d " " -f 1` extracts the first one, which is typically the main IP address (e.g., "192.168.1.100").
         *
         * |- hostname -I
         *    |- cut -d ' ' -f 1
         *                |output -> e.g., "192.168.1.100"|
         */
        this.ADDRESS = this.getCommandOutput('hostname -I | cut -d " " -f 1');
        
        /**
         * Retrieves the external public IPv4 address using the ipify API.
         * The `curl -s -k -m 5 -4 https://api64.ipify.org` command makes a silent request to the ipify API
         * to fetch the public IP address (e.g., "203.0.113.45").
         *
         * |- curl -s -k -m 5 -4
         *    L - https://api64.ipify.org
         *                |output -> e.g., "203.0.113.45"|
         */
        this.WANIP4 = this.getCommandOutput('curl -s -k -m 5 -4 https://api64.ipify.org');
        
        /**
         * Network interface configuration file path.
         * This is a static path pointing to the Netplan configuration file used for the network configuration (e.g., `/etc/netplan/nextcloud.yaml`).
         */
        this.INTERFACES = '/etc/netplan/nextcloud.yaml';
        
        /**
         * Retrieves the default gateway IP address.
         * The `ip route` command shows the routing table. 
         * The `grep default` isolates the line that contains the default gateway, 
         * and `awk '{print $3}'` extracts the third field, which is the gateway IP address (e.g., "192.168.1.1").
         *
         * |- ip route
         *    |- grep 'default'
         *       |- awk '{print $3}'
         *                      |{$1}|{$2}|{$3}|{$4}|{$5}|
         *                      |"default"|"via"|"192.168.1.1"|"dev"|"eth0"|
         *                                             |output -> "192.168.1.1"|
         */
        this.GATEWAY = this.getCommandOutput("ip route | grep default | awk '{print $3}'");
        


        // DNS and ports
        this.INTERNET_DNS = '9.9.9.9';
        this.DNS1 = '9.9.9.9';
        this.DNS2 = '149.112.112.112';
        this.NONO_PORTS = [22, 25, 53, 80, 443, 1024, 3012, 3306, 5178, 5179, 5432, 7867, 7983, 8983, 10000, 8081, 8443, 9443, 9000, 9980, 9090, 9200, 9600, 1234];
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
     * Save variables to a JSON file.
     * @param {string} filePath - The path where the file should be saved.
     */
    saveVariables(filePath) {
        const data = JSON.stringify(this, null, 2);
        fs.writeFileSync(filePath, data, 'utf8');
        console.log(`Variables saved to ${filePath}`);
    }

    /**
     * Load variables from a JSON file and update the class properties.
     * @param {string} filePath - The path from which the file should be loaded.
     */
    loadVariables(filePath) {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            const loadedVars = JSON.parse(data);

            // Update the class with loaded variables
            Object.assign(this, loadedVars);
            console.log(`Variables loaded from ${filePath}`);
        } else {
            console.error(`File not found: ${filePath}`);
        }
    }

    /**
     * Print the current variables to the console.
     */
    printVariables() {
        console.log('Nextcloud Variables:', this);
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
