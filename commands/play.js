const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');


const queue = new Map();

module.exports = {
    name: 'play',
    aliases: ['skip', 'stop'], 
    cooldown: 0,
    description: 'Advanced music bot',
    async execute(message,args, cmd, client, Discord){



        const voice_channel = message.member.voice.channel;
        if (!voice_channel) return message.channel.send('Musíš být ve voice channelu abys mohl spustit bota.');
        const permissions = voice_channel.permissionsFor(message.client.user);
        if (!permissions.has('CONNECT')) return message.channel.send('Nemáš práva na spuštění bota');
        if (!permissions.has('SPEAK')) return message.channel.send('Nemáš práva na spuštění bota');


        const server_queue = queue.get(message.guild.id);


        if (cmd === 'play'){
            if (!args.length) return message.channel.send('Pošli k tomu ještě odkaz a pustí ti to.');
            let song = {};

            if (ytdl.validateURL(args[0])) {
                const song_info = await ytdl.getInfo(args[0]);
                song = { title: song_info.videoDetails.title, url: song_info.videoDetails.video_url }
            } else {

                const video_finder = async (query) =>{
                    const video_result = await ytSearch(query);
                    return (video_result.videos.length > 1) ? video_result.videos[0] : null;
                }

                const video = await video_finder(args.join(' '));
                if (video){
                    song = { title: video.title, url: video.url }
                } else {
                     message.channel.send('Chyba, nemohu najít video.');
                }
            }


            if (!server_queue){

                const queue_constructor = {
                    voice_channel: voice_channel,
                    text_channel: message.channel,
                    connection: null,
                    songs: []
                }
                

                queue.set(message.guild.id, queue_constructor);
                queue_constructor.songs.push(song);
    
                try {
                    const connection = await voice_channel.join();
                    queue_constructor.connection = connection;
                    video_player(message.guild, queue_constructor.songs[0]);
                } catch (err) {
                    queue.delete(message.guild.id);
                    message.channel.send('Chyba připojení.');
                    throw err;
                }
            } else{
                server_queue.songs.push(song);
                return message.channel.send(`**${song.title}** - přidáno do seznamu.`);
            }
        }

        else if(cmd === 'skip') skip_song(message, server_queue);
        else if(cmd === 'stop') stop_song(message, server_queue);
    }
    
}

const video_player = async (guild, song) => {
    const song_queue = queue.get(guild.id);

    if (!song) {
        song_queue.voice_channel.leave();
        queue.delete(guild.id);
        return;
    }
    const stream = ytdl(song.url, { filter: 'audioonly', quality: 'highestaudio', diChunkSize: 0, highWaterMark: 1 << 25, });
    song_queue.connection.play(stream, { seek: 0, volume: 0.5 })
    .on('finish', () => {
        song_queue.songs.shift();
        video_player(guild, song_queue.songs[0]);
    });
    await song_queue.text_channel.send(`Nyní hraje - **${song.title}**`)
}

const skip_song = (message, server_queue) => {
    if (!message.member.voice.channel) return message.channel.send('Musíš být ve voice channelu aby jsi mohl tento příkaz použít.');
    if(!server_queue){
        return message.channel.send(`V seznamu nejsou další songy.`);
    }
    server_queue.connection.dispatcher.end();
}

const stop_song = (message, server_queue) => {
    if (!message.member.voice.channel) return message.channel.send('Musíš být ve voice channelu abys tento příkaz mohl použít.');
    server_queue.songs = [];
    server_queue.connection.dispatcher.end();
}