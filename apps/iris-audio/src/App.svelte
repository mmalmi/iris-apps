<script lang="ts">
  import { loadCatalog } from './lib/catalogSource';
  import { coverArtDataUrl } from './lib/coverArt';
  import { formatDuration, formatPlays } from './lib/format';
  import { getSongAudioUrl } from './lib/audioEngine';
  import type { SongFixture } from './lib/types';
  import { getWorkerClient } from './lib/workerClient';

  const topChips = ['All', 'Electronic', 'Rock', 'Hip-Hop', 'Instrumental', 'Club', 'Focus'];

  let songCatalog: SongFixture[] = [];
  let librarySongsData: SongFixture[] = [];
  let recentSongsData: SongFixture[] = [];
  let shelfSongs: Record<string, SongFixture[]> = { All: [] };
  let remoteIndex: Awaited<ReturnType<typeof loadCatalog>>['searchIndex'] | null = null;
  let query = '';
  let activeChip = 'All';
  let activeSong: SongFixture | null = null;
  let audioUrl = '';
  let isPlaying = false;
  let audioEl: HTMLAudioElement | null = null;
  let loadError = '';
  let searchFocused = false;
  let searchLoading = false;
  let searchError = '';
  let searchInputEl: HTMLInputElement | null = null;
  let selectedSearchIndex = 0;
  let searchBlurTimer: ReturnType<typeof setTimeout> | null = null;

  loadCatalog()
    .then((songs) => {
      songCatalog = songs.featuredSongs;
      librarySongsData = songs.librarySongs;
      recentSongsData = songs.recentSongs;
      shelfSongs = songs.shelves;
      remoteIndex = songs.searchIndex;
      activeSong = songCatalog[0] ?? null;
    })
    .catch((error: unknown) => {
      loadError = error instanceof Error ? error.message : 'Failed to load catalog';
    });

  void getWorkerClient().catch(() => undefined);

  let matchedSongs: SongFixture[] = [];
  let searchNonce = 0;
  $: void (async () => {
    const currentNonce = ++searchNonce;
    if (!query.trim() || !remoteIndex) {
      matchedSongs = [];
      searchLoading = false;
      searchError = '';
      return;
    }
    searchLoading = true;
    searchError = '';
    try {
      const results = await remoteIndex.search(query, activeChip, 12);
      if (currentNonce === searchNonce) {
        matchedSongs = results;
        searchLoading = false;
      }
    } catch (error) {
      if (currentNonce === searchNonce) {
        matchedSongs = [];
        searchLoading = false;
        searchError = error instanceof Error ? error.message : 'Search failed';
      }
    }
  })();

  $: defaultSongs = shelfSongs[activeChip] ?? shelfSongs.All ?? songCatalog;
  $: dropdownSongs = query.trim() ? matchedSongs.slice(0, 8) : [];
  $: showSearchDropdown = !!query.trim() && searchFocused && (searchLoading || dropdownSongs.length > 0 || !!searchError);
  $: playlistSongs = defaultSongs.slice(0, 12);
  $: browseSong = playlistSongs[0] ?? defaultSongs[0] ?? songCatalog[0] ?? activeSong;
  $: recentSongs = recentSongsData.slice(0, 6);
  $: librarySongs = librarySongsData.slice(0, 8);
  $: if (dropdownSongs.length === 0) {
    selectedSearchIndex = 0;
  } else if (selectedSearchIndex >= dropdownSongs.length) {
    selectedSearchIndex = dropdownSongs.length - 1;
  }
  $: if (activeSong) {
    audioUrl = getSongAudioUrl(activeSong);
  }
  $: if (audioEl && audioUrl) {
    const shouldResume = isPlaying;
    audioEl.src = audioUrl;
    audioEl.load();
    if (shouldResume) {
      void audioEl.play().catch(() => {
        isPlaying = false;
      });
    }
  }

  function artwork(song: SongFixture): string {
    return coverArtDataUrl(song.coverSeed, song.accent, song.secondaryAccent);
  }

  async function selectSong(song: SongFixture): Promise<void> {
    activeSong = song;
    isPlaying = true;
    searchFocused = false;
    selectedSearchIndex = 0;
    if (audioEl) {
      audioEl.src = getSongAudioUrl(song);
      await audioEl.play().catch(() => {
        isPlaying = false;
      });
    }
  }

  async function togglePlayback(): Promise<void> {
    if (!audioEl) return;
    if (audioEl.paused) {
      isPlaying = true;
      await audioEl.play().catch(() => {
        isPlaying = false;
      });
      return;
    }
    audioEl.pause();
    isPlaying = false;
  }

  function iconClass(name: string): string {
    const icons: Record<string, string> = {
      home: 'i-lucide-house',
      search: 'i-lucide-search',
      bell: 'i-lucide-bell',
      users: 'i-lucide-users',
      plus: 'i-lucide-plus',
      play: 'i-lucide-play',
      bookmark: 'i-lucide-bookmark',
      list: 'i-lucide-list',
      layoutList: 'i-lucide-layout-list',
      device: 'i-lucide-monitor-speaker',
      volume: 'i-lucide-volume-2',
      shuffle: 'i-lucide-shuffle',
      download: 'i-lucide-download',
      more: 'i-lucide-ellipsis',
      share: 'i-lucide-share-2',
      back: 'i-lucide-chevron-left',
      forward: 'i-lucide-chevron-right',
      skipBack: 'i-lucide-skip-back',
      skipForward: 'i-lucide-skip-forward',
      repeat: 'i-lucide-repeat-2',
      upRight: 'i-lucide-arrow-up-right',
    };
    return icons[name] ?? 'i-lucide-circle';
  }

  function playlistLength(songs: SongFixture[]): string {
    const totalSeconds = songs.reduce((sum, song) => sum + song.duration, 0);
    const totalMinutes = Math.round(totalSeconds / 60);
    return `${songs.length} songs, ${totalMinutes} min`;
  }

  function handleSearchFocus(): void {
    if (searchBlurTimer) {
      clearTimeout(searchBlurTimer);
      searchBlurTimer = null;
    }
    searchFocused = true;
    selectedSearchIndex = 0;
  }

  function handleSearchBlur(): void {
    if (searchBlurTimer) {
      clearTimeout(searchBlurTimer);
    }
    searchBlurTimer = setTimeout(() => {
      searchFocused = false;
      selectedSearchIndex = 0;
      searchBlurTimer = null;
    }, 150);
  }

  function handleSearchKeyDown(event: KeyboardEvent): void {
    if (showSearchDropdown && dropdownSongs.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        selectedSearchIndex = (selectedSearchIndex + 1) % dropdownSongs.length;
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        selectedSearchIndex = (selectedSearchIndex - 1 + dropdownSongs.length) % dropdownSongs.length;
        return;
      }
      if (event.key === 'Enter' && dropdownSongs[selectedSearchIndex]) {
        event.preventDefault();
        void selectSong(dropdownSongs[selectedSearchIndex]);
        return;
      }
    }

    if (event.key === 'Escape') {
      searchFocused = false;
      selectedSearchIndex = 0;
      searchInputEl?.blur();
    }
  }
</script>

<svelte:head>
  <title>Iris Audio</title>
  <meta name="description" content="Responsive music discovery demo with fixture tracks and local search." />
</svelte:head>

{#if loadError}
  <div class="error-state">{loadError}</div>
{:else if activeSong}
  <div class="web-shell">
    <div class="page-frame">
      <header class="topbar">
        <div class="topbar-brand">
          <span class="brand-badge">IA</span>
          <div>
            <strong>Iris Audio</strong>
            <small>Open music catalog</small>
          </div>
        </div>

        <div class="topbar-center">
          <div class="searchbar-wrap">
            <label class="searchbar">
              <span class={`search-icon ${iconClass('search')}`}></span>
              <input
                bind:this={searchInputEl}
                bind:value={query}
                placeholder="What do you want to play?"
                on:focus={handleSearchFocus}
                on:blur={handleSearchBlur}
                on:keydown={handleSearchKeyDown}
              />
              <span class="search-divider"></span>
              <span class={`search-tray ${iconClass('device')}`}></span>
            </label>

            {#if showSearchDropdown}
              <div class="search-dropdown">
                {#if searchLoading}
                  <div class="search-state">Searching “{query}”…</div>
                {:else if searchError}
                  <div class="search-state">{searchError}</div>
                {:else if dropdownSongs.length > 0}
                  {#each dropdownSongs as song, index}
                    <button
                      class:dropdown-row-active={index === selectedSearchIndex}
                      class="dropdown-row"
                      on:mouseenter={() => (selectedSearchIndex = index)}
                      on:mousedown|preventDefault={() => selectSong(song)}
                    >
                      <img alt={song.title} src={artwork(song)} />
                      <span>
                        <strong>{song.title}</strong>
                        <small>{song.artist} · {song.album}</small>
                      </span>
                    </button>
                  {/each}
                {:else}
                  <div class="search-state">No matches for “{query}”.</div>
                {/if}
              </div>
            {/if}
          </div>
        </div>

        <div class="topbar-actions">
          <button class="icon-button" aria-label="Notifications"><span class={iconClass('bell')}></span></button>
          <button class="icon-button" aria-label="Friends"><span class={iconClass('users')}></span></button>
          <button class="avatar-button" aria-label="Profile">
            <span>{activeSong.artist.slice(0, 1)}</span>
          </button>
        </div>
      </header>

      <div class="app-shell">
        <aside class="sidebar panel">
          <div class="library-header">
            <strong>Your Library</strong>
            <div class="library-actions">
              <button class="mini-icon" aria-label="Create playlist"><span class={iconClass('plus')}></span></button>
              <button class="mini-icon" aria-label="Expand library"><span class={iconClass('upRight')}></span></button>
            </div>
          </div>

          <div class="library-chips">
            <button class="library-chip library-chip-active">Playlists</button>
            <button class="library-chip">Artists</button>
            <button class="library-chip">Albums</button>
          </div>

          <div class="library-toolbar">
            <span class={`toolbar-search ${iconClass('search')}`}></span>
            <span class="toolbar-sort">Recents <span class={iconClass('list')}></span></span>
          </div>

          <div class="library-list">
            {#each librarySongs as song, index}
              <button class:library-item-active={song.id === activeSong.id} class="library-item" on:click={() => selectSong(song)}>
                <img alt={song.title} src={artwork(song)} />
                <span class="library-copy">
                  <strong>{index === 0 ? 'Saved mix' : song.title}</strong>
                  <small>{index === 0 ? `${songCatalog.length} imported songs` : `${song.artist}`}</small>
                </span>
              </button>
            {/each}
          </div>
        </aside>

        <main class="main panel">
          <div class="chip-row chip-row-playlist">
            {#each topChips as chip}
              <button class:top-chip-active={chip === activeChip} class="top-chip" on:click={() => (activeChip = chip)}>
                {chip}
              </button>
            {/each}
          </div>

          <section class="playlist-hero">
            <div class="playlist-hero-art">
              <img alt={browseSong.title} class="spotlight-cover" src={artwork(browseSong)} />
            </div>
            <div class="playlist-hero-copy">
              <small>Browse view</small>
              <h1>{activeChip === 'All' ? browseSong.album : `${activeChip} picks`}</h1>
              <p class="playlist-meta-line">
                <strong>{browseSong.artist}</strong>
                <span>· {playlistLength(playlistSongs)}</span>
              </p>
            </div>
          </section>

          <section class="playlist-actions">
            <button class="play-round play-round-large" aria-label="Play selection" on:click={() => selectSong(browseSong)}><span class={iconClass('play')}></span></button>
            <button class="cover-thumb" aria-label="Open featured track" on:click={() => selectSong(browseSong)}>
              <img alt={browseSong.title} src={artwork(browseSong)} />
            </button>
            <button class="outline-round" aria-label="Shuffle"><span class={iconClass('shuffle')}></span></button>
            <button class="outline-round" aria-label="Add to library"><span class={iconClass('plus')}></span></button>
            <button class="outline-round" aria-label="Download"><span class={iconClass('download')}></span></button>
            <button class="outline-round" aria-label="More actions"><span class={iconClass('more')}></span></button>
            <span class="playlist-view-toggle">List <span class={iconClass('layoutList')}></span></span>
          </section>

          <section class="shelf-section">
            <div class="section-head">
              <span class="head-index">#</span>
              <span>Title</span>
              <span>Album</span>
              <span>Vibe</span>
              <span class="head-plays">Plays</span>
              <span class="head-duration">Time</span>
            </div>

            <div class="track-table">
              {#if playlistSongs.length === 0}
                <div class="track-empty">Try another chip filter.</div>
              {:else}
                {#each playlistSongs as song, index}
                  <button class:track-row-active={song.id === activeSong.id} class="track-row" on:click={() => selectSong(song)}>
                    <span class="track-index">{index + 1}</span>
                    <span class="track-meta">
                      <img alt={song.title} class="track-art" src={artwork(song)} />
                      <span>
                        <strong class="track-mainline">{song.title}</strong>
                        <small class="track-subline">{song.artist} · {song.album}</small>
                      </span>
                    </span>
                    <span class="track-album">{song.album}</span>
                    <span class="track-muted track-mood">{song.mood}</span>
                    <span class="track-muted track-plays">{formatPlays(song.plays)}</span>
                    <span class="track-duration">{formatDuration(song.duration)}</span>
                  </button>
                {/each}
              {/if}
            </div>
          </section>
        </main>

        <aside class="queue panel">
          <section class="now-panel">
            <div class="queue-topline">
              <strong>{activeSong.album}</strong>
              <span class={iconClass('more')}></span>
            </div>
            <img alt={activeSong.title} class="now-cover" src={artwork(activeSong)} />
            <h2>{activeSong.title}</h2>
            <p class="now-subtitle">{activeSong.artist}</p>
            <div class="queue-inline-actions">
              <button class="tiny-action" aria-label="Share"><span class={iconClass('share')}></span></button>
              <button class="tiny-action" aria-label="Save"><span class={iconClass('bookmark')}></span></button>
            </div>
            <div class="lyrics-card">
              <strong>Lyrics preview</strong>
              <p>With the fire from the fireworks up above me</p>
            </div>
            <div class="about-card">
              <strong>About the artist</strong>
              <p>{activeSong.artist} blends {activeSong.instruments.join(', ')} into a {activeSong.mood} leaning set.</p>
            </div>
            <div class="related-strip">
              {#each recentSongs.slice(0, 2) as song}
                <button class="related-card" on:click={() => selectSong(song)}>
                  <img alt={song.title} src={artwork(song)} />
                  <span>{song.title}</span>
                </button>
              {/each}
            </div>
          </section>
        </aside>
      </div>

      <footer class="player-bar">
        <div class="player-song">
          <img alt={activeSong.title} src={artwork(activeSong)} />
          <div>
            <strong>{activeSong.title}</strong>
            <span>{activeSong.artist}</span>
          </div>
          <button class="tiny-action" aria-label="Add to queue"><span class={iconClass('plus')}></span></button>
        </div>

        <div class="player-center">
          <div class="player-buttons">
            <button class="transport" aria-label="Repeat"><span class={iconClass('repeat')}></span></button>
            <button class="transport" aria-label="Previous"><span class={iconClass('skipBack')}></span></button>
            <button class="transport transport-play" aria-label={isPlaying ? 'Pause' : 'Play'} on:click={togglePlayback}><span class={iconClass('play')}></span></button>
            <button class="transport" aria-label="Next"><span class={iconClass('skipForward')}></span></button>
            <button class="transport" aria-label="Shuffle"><span class={iconClass('shuffle')}></span></button>
          </div>
          <div class="audio-wrap">
            <span>{formatDuration(Math.max(activeSong.duration - 61, 0))}</span>
            <audio bind:this={audioEl} on:pause={() => (isPlaying = false)} on:play={() => (isPlaying = true)} controls preload="auto">
              <track kind="captions" />
            </audio>
            <span>{formatDuration(activeSong.duration)}</span>
          </div>
        </div>

        <div class="player-meta">
          <button class="tiny-action" aria-label="Devices"><span class={iconClass('device')}></span></button>
          <button class="tiny-action" aria-label="Volume"><span class={iconClass('volume')}></span></button>
        </div>
      </footer>
    </div>
  </div>
{:else}
  <div class="loading-state">Loading audio catalog…</div>
{/if}
