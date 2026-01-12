mkdir ~/.local/bin
echo "Downloading n..."
curl -fsSL -o ~/.local/bin/n https://raw.githubusercontent.com/tj/n/master/bin/n
chmod 0755 ~/.local/bin/n
export N_PREFIX="$HOME/.local"
export PATH="$N_PREFIX/bin:$PATH"
echo "n successfully installed!"
echo "Downloading lts"
n install lts
echo "Setting TLS Permissions"
export NODE_TLS_REJECT_UNAUTHORIZED=0
npm config set strict-ssl false
echo "Downloading svelte"
npm install svelte vite @sveltejs/vite-plugin-svelte