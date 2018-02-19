#!/usr/local/bin/node
const request = require('request');
const path = require('path');
const fs = require('fs');
const Magic = require('mmmagic').Magic;
const Entities = require('html-entities').AllHtmlEntities;

const entities = new Entities();

const IMGUR_CLIENT_ID = process.env.IMGUR_CLIENT_ID || '5beb783df007abb';

// check if the user is passing a subreddit
const subReddit = process.argv[2] || 'wallpapers';
const wallpapersPath = 'https://www.reddit.com/r/' + subReddit + '/hot.json?t=week&limit=10';

// get download directory, by default /{userHome}/.redditWallpapers
const downloadDirectory = process.argv[3] || path.join(getUserHome(), '.redditWallpapers');

// request reddit API last hot posts
request(wallpapersPath, function(error, response, body) {
    if (error || response.statusCode != 200) {
        return console.error(error);
    }

    const redditResponse = JSON.parse(body);

    // iterate posts
    for (let i = 0; i < redditResponse.data.children.length; i++) {
        const item = redditResponse.data.children[i];
        const domain = item.data.domain;
        const isImgur = domain.indexOf('imgur.com') !== -1;
        const isRedditImage = domain.indexOf('i.redd.it') !== -1;

        // only download imgur reddit / links
        if (!isImgur && !isRedditImage) {
            continue;
        }

        // create folder if it doesn't exist
        mkdirSync(downloadDirectory);
        const postData = redditResponse.data.children[i].data;
        const imageUrl = isImgur ? postData.url : postData.preview.images[0].source.url;

        if (isAlbum(imageUrl)) {
            const albumId = imageUrl.substr(imageUrl.lastIndexOf('/') + 1, imageUrl.length);

            request({
                url: 'https://api.imgur.com/3/album/' + albumId,
                headers: {
                    Authorization: 'Client-ID ' + IMGUR_CLIENT_ID
                }
            }, function(error, response, body) {
                if(error || response.statusCode != 200) {
                    console.error(error);
                    return;
                }
                const imgurResponse = JSON.parse(body);
                removeAllFilesFolder(downloadDirectory);
                for (let j = 0; j < imgurResponse.data.images.length; j++) {
                    downloadImage(downloadDirectory, imgurResponse.data.images[j].link, false);
                }
            });

        } else {
            // only download image if it doesn't exist
            downloadImage(downloadDirectory, imageUrl, true);
        }
        return;
    }
});

function getUserHome() {
    return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

function mkdirSync(path) {
    try {
        fs.mkdirSync(path);
    } catch(e) {
        if ( e.code != 'EEXIST' ) throw e;
    }
}

function isAlbum(imgurUrl) {
    return imgurUrl.match(/\/a\//gi);
}

function removeAllFilesFolder(folderPath) {
    const files = fs.readdirSync(folderPath);
    files.forEach(function (file) {
        // DANGER remove all files under /{userHome}/.redditWallpapers
        fs.unlinkSync(path.join(downloadDirectory, file));
    });
}

function downloadImage(downloadDirectory, imageUrl, removeImages) {
    const downloadPath = path.join(downloadDirectory, imageUrl.replace(/http(s?):/gi, '').replace(/\//gi, ''));

    // if not exists download image
    if (!fs.existsSync(downloadPath)) {

        if (removeImages) {
            removeAllFilesFolder(downloadDirectory);
        }
        request(entities.decode(imageUrl)).pipe(fs.createWriteStream(downloadPath)).on('finish', function() {
            const magic = new Magic();
            magic.detectFile(downloadPath, function(err, result) {
                if (err) throw err;
                const extension = result.split(' ')[0].toLowerCase();
                fs.renameSync(downloadPath, downloadPath + '.' + extension);
            });
        });
    }
}
