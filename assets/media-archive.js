// Progressive players for this archive only. Source links work without JavaScript.
(() => {
  const dialog = document.querySelector('#media-dialog');
  if (!dialog) return;
  const player = document.querySelector('#player-area');
  const title = document.querySelector('#dialog-title');
  const source = document.querySelector('#media-source-link');
  const credit = document.querySelector('#media-credit');
  const help = document.querySelector('#player-help');
  const close = dialog.querySelector('.close-media');
  if (!player || !title || !source || !credit || !help || !close) return;
  let opener, generation = 0, widgetsPromise;

  function loadX() {
    if (window.twttr?.widgets) return Promise.resolve(window.twttr);
    if (widgetsPromise) return widgetsPromise;
    widgetsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      let timer;
      const finish = error => {
        clearTimeout(timer);
        script.onload = script.onerror = null;
        if (error) { script.remove(); reject(error); }
        else resolve(window.twttr);
      };
      timer = setTimeout(() => finish(new Error('X timed out')), 15000);
      script.src = 'https://platform.twitter.com/widgets.js';
      script.async = true;
      script.onload = () => finish(window.twttr?.widgets ? null : new Error('X unavailable'));
      script.onerror = () => finish(new Error('X unavailable'));
      document.head.append(script);
    }).catch(error => { widgetsPromise = undefined; throw error; });
    return widgetsPromise;
  }

  document.querySelectorAll('.media-archive [data-media]').forEach(link => {
    link.addEventListener('click', async event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0 || typeof dialog.showModal !== 'function') return;
      const kind = link.dataset.media;
      const url = new URL(link.href);
      const tweetId = kind === 'x' && url.hostname === 'x.com' && url.pathname.match(/^\/[^/]+\/status\/(\d+)$/)?.[1];
      const videoId = kind === 'youtube' && url.hostname === 'www.youtube.com' && url.searchParams.get('v');
      const thumb = kind === 'photo' && link.closest('article')?.querySelector('img');
      if (url.protocol !== 'https:' || !(tweetId || (videoId && /^[\w-]{11}$/.test(videoId)) || thumb)) return;
      event.preventDefault();
      opener = link;
      const token = ++generation;
      title.textContent = link.dataset.title;
      credit.textContent = link.dataset.credit;
      source.href = link.href;
      help.hidden = kind === 'photo';
      player.replaceChildren();
      dialog.showModal();
      document.body.classList.add('media-open');
      if (kind === 'photo') {
        const img = document.createElement('img');
        img.src = thumb.src;
        img.alt = thumb.alt;
        player.append(img);
      } else if (kind === 'youtube') {
        const iframe = document.createElement('iframe');
        iframe.title = link.dataset.title;
        iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1&rel=0`;
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        iframe.allowFullscreen = true;
        iframe.referrerPolicy = 'strict-origin-when-cross-origin';
        player.append(iframe);
      } else {
        const status = document.createElement('p');
        status.className = 'player-status';
        status.setAttribute('role','status');
        status.textContent = 'Loading the full episode from X…';
        const host = document.createElement('div');
        host.className = 'x-host';
        player.append(status,host);
        let timer;
        try {
          const x = await loadX();
          if (token !== generation || !dialog.open) return;
          const embedded = await Promise.race([
            x.widgets.createTweet(tweetId,host,{theme:'dark',dnt:true,conversation:'none',align:'center'}),
            new Promise((_,reject) => { timer = setTimeout(() => reject(new Error('Embed timeout')),15000); })
          ]);
          if (token !== generation || !dialog.open) { host.replaceChildren(); return; }
          status.textContent = embedded ? '' : 'The X player is unavailable here. Use the original source below.';
        } catch {
          if (token === generation && dialog.open) status.textContent = 'The X player is unavailable here. Use the original source below.';
        } finally { clearTimeout(timer); }
      }
    });
  });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    generation++;
    player.replaceChildren();
    document.body.classList.remove('media-open');
    opener?.focus();
  });
})();
