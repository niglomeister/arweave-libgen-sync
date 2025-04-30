# Libgen arweave sync

## How to run

### get the catalogue
- got to https://data.library.bz/dbdumps/ and download the latest database dump for fiction books. 
They contain a database of metadata for every book (Title, author, year ...)


 - Extract the fiction.sql file. Install mariadb and execute the fiction.sql file to load the database on your machine

 ```bash
 mysql -u root -p libgen < fiction.sql
 ```

### get the books

The books are served separately in torrent form. 
Each torrent serves 1000 books. They are arranged in the same order as in the catalogue database so the first 1000 rows of metadata will correspond to the 1000 books served from the *f_0.torrent* file.

Go download them there https://libgen.is/fiction/repository_torrent/ and then download the torrents content to libgen_book/fiction/

### link your wallet

Once you have the content and the metadata, export the keyfile of an arweave wallet with some $AR on it and save it at the top level under the name keyfile_arweave.json


### upload

run the program with.

```bash
node libgen_upload.js
```

Before uploading, the programm will download the sync registry from Arweave to avoid duplicates.

Make sure to download the content of a torrent entirely before running the script or the wrong books might get uploaded because of ordering


## About

We are trying to upload the whole Libgen (libgen.is) catalog to Arweave so it may be accessible and searchable forever on the permaweb, starting with the fiction section (because it is the smallest).

You can fork this repo and contribute to this effort by connecting a wallet with some $AR and running the script or send $AR or at this wallet that i will use to upload more books ( X9CZKCbX_GRxHtnsaa8pCTe-bQRZCIH0aOaIiYBjJg4 ).






