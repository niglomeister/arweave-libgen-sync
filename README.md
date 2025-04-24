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

If you want to use the turbo bundler set the "bundler" variable to "turbo" and make sure to top up your turbo credits with the same wallet that you used for the keyfile.

you can topup using the turbo CLI https://github.com/ardriveapp/turbo-sdk?tab=readme-ov-file#cli or directly on their website at https://turbo-topup.com .
This step is highly recommended as you might suffer from rate limiting uploading to the standard arweave gateways and will pay more per transaction.


### upload

run the program with.

```bash
node libgen_upload.js
```

Before uploading, the programm will check that a given book does not exist on arweave under the same app-name as to avoid paying for duplicates.
The books that you uploaded or that were found to already exist on the network are written down in a new "arweave_transactions" table in the database to avoid checking the network every time

## About

We are trying to upload the whole Libgen (libgen.is) catalog to Arweave so it may be accessible and searchable forever on the permaweb, starting with the fiction section (because it is the smallest).

You can fork this repo and contribute to this effort by connecting a wallet with some $AR or turbo credit and running the script. 

The programm will check on different gateways first if a book has already been uploaded before going through with the upload so you wont waste credits on it.





