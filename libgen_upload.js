//import { TurboFactory } from '@ardrive/turbo-sdk';
import Arweave from 'arweave'
import mysql from 'mysql2/promise'
import fs, { readdirSync } from 'fs'
import { readFile } from 'fs/promises'
import {
    ArweaveSigner,
    createData,
    bundleAndSignData
} from "@dha-team/arbundles/node";
import * as dotenv from "dotenv"

dotenv.config()

const category = 'fiction'
const app_name = 'Libgen'
const app_version = '0.1'
const book_dir = './libgen_books/' + category
const ext_to_mime = {
    // Documents
    "pdf": "application/pdf",
    "txt": "text/plain",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "rtf": "application/rtf",
    "odt": "application/vnd.oasis.opendocument.text",
    "wps": "application/vnd.ms-works",
    "wri": "application/x-mswrite",
    "wpd": "application/wordperfect",
    "text": "text/plain",
    "wbk": "application/msword",

    // Spreadsheets
    "xls": "application/vnd.ms-excel",
    "ods": "application/vnd.oasis.opendocument.spreadsheet",

    // Presentations
    "ppt": "application/vnd.ms-powerpoint",
    "pps": "application/vnd.ms-powerpoint",

    // E-books and publishing formats
    "epub": "application/epub+zip",
    "mobi": "application/x-mobipocket-ebook",
    "azw": "application/vnd.amazon.ebook",
    "azw1": "application/vnd.amazon.ebook",
    "azw3": "application/vnd.amazon.ebook",
    "azw4": "application/vnd.amazon.ebook",
    "fb2": "application/x-fictionbook+xml",
    "lrf": "application/x-sony-bbeb",
    "lit": "application/x-ms-reader",
    "prc": "application/x-mobipocket-ebook",
    "pdb": "application/vnd.palm",
    "tcr": "application/x-tcr-ebook",
    "snb": "application/x-snb-ebook",
    "imp": "application/x-imp",
    "oeb": "application/oebps-package+xml",
    "ebo": "application/x-ebook",
    "ebn": "application/x-ebook",
    "ebq": "application/x-ebook",
    "pmlz": "application/x-pmlz",
    "tpz": "application/x-topaz-ebook",

    // Web formats
    "html": "text/html",
    "htm": "text/html",
    "shtml": "text/html",
    "xhtml": "application/xhtml+xml",
    "mht": "message/rfc822",
    "htmlz": "application/zip+html",
    "htmz": "application/zip+html",

    // Archive formats
    "zip": "application/zip",
    "rar": "application/x-rar-compressed",
    "7z": "application/x-7z-compressed",
    "cab": "application/vnd.ms-cab-compressed",
    "tar.gz": "application/x-tar",
    "gz": "application/gzip",
    "bz2": "application/x-bzip2",
    "z": "application/x-compress",
    "sit": "application/x-stuffit",
    "sitx": "application/x-stuffitx",

    // Comics
    "cbr": "application/x-cbr",
    "cbz": "application/x-cbz",

    // Image formats
    "tif": "image/tiff",
    "tiff": "image/tiff",
    "bmp": "image/bmp",

    // XML-based formats
    "xml": "application/xml",
    "kml": "application/vnd.google-earth.kml+xml",
    "ncx": "application/x-dtbncx+xml",

    // Other document formats
    "chm": "application/vnd.ms-htmlhelp",
    "hlp": "application/winhlp",
    "djvu": "image/vnd.djvu",
    "pub": "application/x-mspublisher",
    "indd": "application/x-indesign",
    "mso": "application/x-mso",
    "rgo": "application/x-rgo",
    "asc": "text/plain",
    "nfo": "text/plain",
    "tml": "text/plain",
    "txtz": "application/x-txtz",

    // Font formats
    "otf": "font/otf",

    // Other types
    "iso": "application/x-iso9660-image",
    "exe": "application/x-msdownload",
    "jar": "application/java-archive",
    "lnk": "application/x-ms-shortcut",
    "tr": "application/x-troff",
    "mrc": "application/marc",
    "ace": "application/x-ace-compressed",
    "ipd": "application/x-ipd",
    "rb": "text/x-ruby"
};

//initalize arweave stuff
const key = JSON.parse(fs.readFileSync('./keyfile_arweave.json'))
const arweave = Arweave.init({
    host: 'arweave.net',
    port: 443,
    protocol: 'https',
    timeout: 10000
})
const signer = new ArweaveSigner(key)

// connect to the metadata db
const con = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: process.env.ROOT_PASSWORD,
    database: 'libgen'
});


const folder_sync_registry = await get_sync_registry()
const all_dirs = getDirectories(book_dir)

const dirs_to_upload = {}
for (const d of all_dirs) {
    if (folder_sync_registry[d] === undefined) {
        dirs_to_upload[d] = { uploaded: 0, total: 1000 }
    }
    else if (folder_sync_registry[d].uploaded < folder_sync_registry[d].total) {
        dirs_to_upload[d] = folder_sync_registry[d]
    }
}

console.log("folder already uploaded : ", folder_sync_registry, ", will upload :", dirs_to_upload)
for (const d of Object.keys(dirs_to_upload)) {
    let files_dir = book_dir + '/' + d

    const all_filenames = readdirSync(files_dir).sort()
    const filenames = all_filenames.slice(dirs_to_upload[d].uploaded, dirs_to_upload[d].total)

    console.log(` ======= UPLOADING CONTENT OF ${d} DIRECTORY ========= `)

    for (let i = 0; i < filenames.length; i += 10) {
        const batch = filenames.slice(i, i + 10)

        const items = []
        for (const filename of batch) {
            const md5 = get_md5(filename)
            const filepath = files_dir + '/' + filename
            const tags = await get_tags(md5, con)
            const book_file = await readFile(filepath)

            const item = createData(book_file, signer, { tags: tags })
            items.push(item)
        }
        const bundle = await bundleAndSignData(items, signer)
        console.log('items ids : ', bundle.getIds())

        let transaction = await bundle.toTransaction({}, arweave, key)

        await arweave.transactions.sign(transaction, key)


        const uploader = await arweave.transactions.getUploader(transaction)

        while (!uploader.isComplete) {
            await uploader.uploadChunk()
            console.log(uploader.pctComplete, '% uploaded')
        }

        console.log('uploaded bundle at txid : ', transaction.id)
        console.log(`uploaded ${i + batch.length} books out of ${all_filenames.length} for folder ${d} `)
        folder_sync_registry[d] = { uploaded: i + batch.length, total: all_filenames.length }
        await upload_sync_registry(folder_sync_registry, key)

    }
}

console.log("finished uploading the content of all folders at : ", book_dir)
await con.end();





async function get_tags(md5, con) {


    const [rows, results] = await con.execute(`
    SELECT f.*, 
     fd.Descr,
     fh.crc32, fh.edonkey, fh.aich, fh.sha1, fh.tth, fh.btih, fh.sha256, fh.ipfs_cid
    FROM fiction f
    LEFT JOIN fiction_description fd ON f.md5 = fd.MD5
    LEFT JOIN fiction_hashes fh ON f.md5 = fh.md5
    WHERE f.md5 = "${md5}"`
    );
    const book_info = rows[0]

    const default_tags = {
        "App-Name": app_name,
        'App-Version': app_version,
        "Type": ['book'],
        'Topic': ['book', 'libgen', category],
        'Unix-Timestamp': Math.floor(Date.now() / 1000)
    }

    const filled_tags = {
        "Title": book_info.Title,
        'Content-Type': ext_to_mime[book_info.Extension],
        'Description': book_info.Descr,
        'Category': category,
        'Content-Disposition': `attachment; filename="${book_info.Locator}"`,
        'ISBN': book_info.Identifier
    }


    let tags = { ...filled_tags, ...default_tags, ...book_info }

    const formated_tags = []
    for (let [k, v] of Object.entries(tags)) {
        v = v ?? ''
        formated_tags.push({ name: String(k), value: String(v) })
    }

    return formated_tags

}

function get_md5(filename) {

    const md5 = filename.split('.')[0].toUpperCase()
    const md5Regex = /^[a-fA-F0-9]{32}$/;
    if (!md5 || typeof md5 !== 'string' || !md5Regex.test(md5)) {
        throw new Error('MD5 hash must be a string and must be 32 hexadecimal characters');
    }
    return md5

}


function getDirectories(source) {
    return fs.readdirSync(source, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
}

async function get_sync_registry() {
    try {
        // GraphQL query to find the latest registry transaction
        const query = `{
        transactions(
          tags: [
            {
              name: "App-Name", 
              values: ["${app_name}-sync-registry"]
            },
            {
              name: "Category", 
              values : "${category}"
            }
          ],
          first: 1,
          sort: HEIGHT_DESC
        ) {
          edges {
            node {
              id
            }
          }
        }
      }`;

        console.log(query)

        // Execute the query
        const response = await fetch('https://arweave.net/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query })
        });

        const result = await response.json();

        // Check if we found any registry
        if (!result.data.transactions.edges.length) {
            console.log('No registry found. Starting with an empty registry.');
            return {};
        }

        // Get the transaction ID of the latest registry
        const txId = result.data.transactions.edges[0].node.id;
        console.log('found : ', result.data.transactions.edges)
        console.log(`Found latest registry at transaction: ${txId}`);

        // Fetch the registry data
        const registryResponse = await fetch(`https://arweave.net/${txId}`);
        const registryData = await registryResponse.json();

        return registryData;
    } catch (error) {
        console.error('Error fetching latest registry:', error);
        throw error;
    }
}

async function upload_sync_registry(updatedRegistry, walletJwk) {
    try {
        console.log(`Uploading updated registry `);

        const arweave = Arweave.init({
            host: 'arweave.net',
            port: 443,
            protocol: 'https',
            timeout: 10000
        })

        // Create a transaction with the updated registry
        const data = JSON.stringify(updatedRegistry);
        const transaction = await arweave.createTransaction({
            data: data
        }, walletJwk);

        transaction.addTag('Content-Type', 'application/json');
        transaction.addTag('App-Name', `${app_name}-sync-registry`);
        transaction.addTag('Unix-Time', String(Math.round(Date.now() / 1000)));
        transaction.addTag('Registry-Version', String(updatedRegistry.length));
        transaction.addTag('Category', category);

        await arweave.transactions.sign(transaction, walletJwk);

        const uploader = await arweave.transactions.getUploader(transaction);

        while (!uploader.isComplete) {
            await uploader.uploadChunk();
            console.log(`${uploader.pctComplete}% complete, ${uploader.uploadedChunks}/${uploader.totalChunks}`);
        }

        console.log(`Registry uploaded successfully! Transaction ID: ${transaction.id}`);
        return transaction.id;
    } catch (error) {
        console.error('Error uploading updated registry:', error);
        throw error;
    }
}
