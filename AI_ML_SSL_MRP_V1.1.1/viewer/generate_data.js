const fs = require('fs');
const path = require('path');

// Assuming script is in /viewer/generate_data.js
// Path: viewer -> root -> system_documentation
const rootDir = path.resolve(__dirname, '../system_documentation');
const outputFile = path.resolve(__dirname, 'js/data.js');

console.log('Script running in:', __dirname);
console.log('Looking for docs in:', rootDir);
console.log('Writing to:', outputFile);

const data = {
    technical_reference: {},
    user_manuals: {},
    root: {}
};

function readFiles() {
    try {
        if (!fs.existsSync(rootDir)) {
            console.error('Root dir not found!');
            return;
        }

        // Read root files
        ['API_DOCS.md', 'ARCHITECTURE.md', 'DATABASE_SCHEMA.md', 'DEPLOY_GUIDE.md'].forEach(file => {
            const filePath = path.join(rootDir, file);
            if (fs.existsSync(filePath)) {
                data.root[path.basename(file, '.md')] = fs.readFileSync(filePath, 'utf8');
                console.log(`Loaded ${file}`);
            }
        });

        // Tech
        const techDir = path.join(rootDir, 'technical_reference');
        if (fs.existsSync(techDir)) {
            fs.readdirSync(techDir).forEach(file => {
                if (file.endsWith('.md')) {
                    data.technical_reference[path.basename(file, '.md')] = fs.readFileSync(path.join(techDir, file), 'utf8');
                    console.log(`Loaded ${file}`);
                }
            });
        }

        // Manuals
        const userDir = path.join(rootDir, 'user_manuals');
        if (fs.existsSync(userDir)) {
            fs.readdirSync(userDir).forEach(file => {
                if (file.endsWith('.md')) {
                    data.user_manuals[path.basename(file, '.md')] = fs.readFileSync(path.join(userDir, file), 'utf8');
                    console.log(`Loaded ${file}`);
                }
            });
        }

        const dir = path.dirname(outputFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        fs.writeFileSync(outputFile, `const docData = ${JSON.stringify(data, null, 4)};`);
        console.log('File written successfully. Size:', fs.statSync(outputFile).size);

    } catch (error) {
        console.error('Error:', error);
    }
}

readFiles();
