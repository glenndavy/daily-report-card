{
  description = "SMB Report Card — Tauri 2 + SQLite dev shell";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" ];
      forAll = f: nixpkgs.lib.genAttrs systems (system:
        f nixpkgs.legacyPackages.${system});
    in
    {
      devShells = forAll (pkgs: {
        default = pkgs.mkShell {
          packages = with pkgs; [
            rustc
            cargo
            rustfmt
            clippy
            cargo-tauri
            nodejs_22
            pkg-config
          ];

          buildInputs = with pkgs; [
            openssl
            webkitgtk_4_1
            gtk3
            libayatana-appindicator
            librsvg
            glib
            gdk-pixbuf
            libsoup_3
            glib-networking
          ];

          shellHook = ''
            # WebKitGTK DMA-BUF renderer is flaky on some GPUs/compositors
            # (notably NVIDIA and some Wayland setups incl. Hyprland).
            export WEBKIT_DISABLE_DMABUF_RENDERER=1
            # TLS modules for the webview (harmless for a local-only app).
            export GIO_EXTRA_MODULES=${pkgs.glib-networking}/lib/gio/modules
            echo "Tauri dev shell ready: npm install && npm run tauri dev"
          '';
        };
      });
    };
}
