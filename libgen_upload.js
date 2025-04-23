//import { TurboFactory } from '@ardrive/turbo-sdk';
import Arweave from 'arweave'
import mysql from 'mysql2/promise'
import fs, { readdirSync } from 'fs'
import { readFile } from 'fs/promises'
import {TurboFactory } from '@ardrive/turbo-sdk'
import * as dotenv from "dotenv"

dotenv.config()

const category = 'fiction'
const app_name = 'Libgen'
const app_version = '0.1'
const book_dir = './libgen_books/' + category
const bundler = 'turbo'
const gateways = ['arweave.net', 'daemongate.io','frogzz.xyz','cyanalp.cfd', 'permadao.io']
const ext_to_mime  = {
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


// connect to the metadata db
const con = await mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: process.env.ROOT_PASSWORD,
  database: 'libgen'
});

//create a table to write down the books you already uploaded and the corresponding txid, as to not have to check the gateway every time 
const res1 = await con.execute(`
CREATE TABLE IF NOT EXISTS arweave_transactions (
  id int(15) unsigned NOT NULL AUTO_INCREMENT,
  MD5 char(32) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  arweave_txid char(43) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  locator VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci COMMENT 'Stores filenames',
  upload_timestamp timestamp NOT NULL DEFAULT current_timestamp(),
  status varchar(20) NOT NULL DEFAULT 'completed',
  PRIMARY KEY (id),
  UNIQUE KEY arweave_txid (arweave_txid),
  UNIQUE KEY MD5 (MD5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;`)




for (const d of getDirectories(book_dir)) {
  let files_dir = book_dir + '/' + d

  const all_filenames = readdirSync(files_dir)
  console.log(` ======= UPLOADING CONTENT OF ${d} DIRECTORY ========= `)

  for (let i = 0; i < all_filenames.length ; i+=10) {
    //switch gateway every batch to get around the rate limiting
    let gateway_url = gateways[(i/10)%gateways.length]

    const arweave = Arweave.init({
      host: 'arweave.net',
      port: 443,
      protocol: 'https',
      timeout : 10000
    })

    const batch = all_filenames.slice(i, i+10)

    //skip the books already uploaded to arweave
    const results = await Promise.all(batch.map(f => is_already_uploaded(f, arweave,con)));
    const filenames = batch.filter((_, index) => !results[index]);

    console.log("files to upload :",filenames)


    const uploadPromises = filenames.map(f => upload_book(f, files_dir, con, arweave, key));
    const uploads = await Promise.all(uploadPromises);

    console.log("Uploaded the following books to arweave :",uploads)
    console.log(`${i}/${all_filenames.length}`)

  }

  console.log('stopping after first folder')


}

await con.end();



async function upload_book(filename, files_dir, con, arweave, key) {
  
  const md5 = get_md5(filename)
  const filepath = files_dir + '/' + filename
  const tags = await get_tags(md5,con)
  const book_file = await readFile(filepath)

  let txid = null
  if (bundler == "turbo") {
    const turbo = TurboFactory.authenticated({ privateKey: key })
    const fileSize = fs.statSync(filepath).size;

    const formated_tags = []
    for (let [k,v] of Object.entries(tags)){
      v = v ?? ''
      formated_tags.push({name : k, value : String(v)})
    }

    const resp_upload = await turbo.uploadFile({
          fileStreamFactory: () => book_file,
          fileSizeFactory: () => fileSize,
          dataItemOpts: {
            tags: formated_tags,
          }
        });

    if (!resp_upload.id) throw new Error("book couldnt be uploaded to turbo properly") 
    txid = resp_upload.id
  }
  else {
    let transaction = await arweave.createTransaction(  {data : book_file}, key)

    for (let [k,v] of Object.entries(tags)){
      v = v ?? ''
      transaction.addTag(k,v)
    }
    
    await arweave.transactions.sign(transaction, key)

    const uploader = await arweave.transactions.getUploader(transaction)

    while ( !uploader.isComplete) {
      await uploader.uploadChunk()
      console.log(uploader.pctComplete, '% uploaded')
    }

    txid = transaction.id

  }
  if (!typeof(txid) === 'string' || txid.length !== 43) throw new Error(`invalid txid : ${txid}. Txid must be strings of length 43`)
  console.log(`uploaded book ${md5} to txid ${txid} with title ${tags.Title}`)
  await save_as_uploaded(md5, txid, tags.Locator, con)
  return { md5 : md5, txid : txid, locator : tags.Locator}
}


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
    "App-Name" : app_name,
    'App-Version' : app_version,
    "Type": ['book'],
    'Topic' : ['book', 'libgen', category],
    'Unix-Timestamp' : Math.floor(Date.now() / 1000)
    }
  
  const filled_tags = { 
    "Title" : book_info.Title,
    'Content-Type': ext_to_mime[book_info.Extension],
    'Description' : book_info.Descr,
    'Category' : category,
    'Content-Disposition': `attachment; filename="${book_info.Locator}"`,
    'ISBN' : book_info.Identifier }
  

  return {...filled_tags, ...default_tags, ...book_info}
  
}

function get_md5(filename) {

  const md5 = filename.split('.')[0].toUpperCase()
  const md5Regex = /^[a-fA-F0-9]{32}$/;
  if (!md5 || typeof md5 !== 'string' || !md5Regex.test(md5)) {
    throw new Error('MD5 hash must be a string and must be 32 hexadecimal characters');
  }
  return md5

}

async function is_already_uploaded(filename, arweave, con) {
  const md5 = get_md5(filename)

  //check if the book is already marked as uploaded in our local database, this avoids querying gateways every time
  const [rows, results] = await con.execute(`
    SELECT * from arweave_transactions where MD5 = "${md5}"
    `)

  if (rows.length !== 0){
    return true
  }
  
  // query the gateway to be sure the book isnt already on arweave
  const queryObject = {
    query: `{
      transactions(
        tags: [
          { name: "App-Name", values: ["${app_name}"] },
          { name: "MD5", values: "${md5}" }
        ],
      ) {
        edges {
          node {
            id
            tags {
              name
              value
            }
          }
        }
      }
    }`
  };
  
  const response = await arweave.api.post('/graphql', queryObject);
  const matching_txs = response.data?.data?.transactions?.edges

  // if already uploaded, add the book to our local "uploaded books" table so we don't have to query the gateway again next time
  if (matching_txs && matching_txs.length) {
    const txid = matching_txs[0]['node']['id']
    const locator = matching_txs[0].node.tags.find(tag => tag.name === "Locator").value
    console.log(`found book ${md5} at txid ${txid}. SKIPPING and marking as uploaded`)
    await save_as_uploaded(md5, txid, locator, con)
    return true
  }

  return false
}
  

async function save_as_uploaded(md5, txid, locator, con) {
    await con.execute(`
        INSERT IGNORE INTO arweave_transactions (MD5, arweave_txid, locator, status)
        VALUES ("${md5}", "${txid}" , "${locator}","completed")
    `);
  }

  function getDirectories(source) {
    return fs.readdirSync(source, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
  }
