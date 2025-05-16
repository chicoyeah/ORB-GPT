import tkinter as tk
import random
import requests
import webbrowser
import threading
import io
from PIL import Image, ImageTk

# === CONFIG ===
OSU_CLIENT_ID = "Your_Client_ID"  # Replace with your actual client ID if necessary
OSU_CLIENT_SECRET = "Your_Client_Secret"  # Replace with your actual client secret
NUM_ATTEMPTS = 15  # Number of parallel attempts in one batch

current_url = ""
current_map_id = ""
loading_dots = 0
loading_running = False
current_thumbnail_photo = None  # To keep a reference to the image

# === FUNCTIONS ===
def get_osu_token():
    try:
        res = requests.post(
            "https://osu.ppy.sh/oauth/token",
            json={
                "client_id": OSU_CLIENT_ID,
                "client_secret": OSU_CLIENT_SECRET,
                "grant_type": "client_credentials",
                "scope": "public"
            }, timeout=10
        )
        res.raise_for_status()
        return res.json().get('access_token')
    except Exception as e:
        print(f"Error getting osu! token: {e}")
        return None


def fetch_map_by_id(random_id, token):
    try:
        res = requests.get(
            f"https://osu.ppy.sh/api/v2/beatmapsets/{random_id}",
            headers={"Authorization": f"Bearer {token}"}, timeout=10
        )
        if res.status_code != 200:
            return None
        data = res.json()
        if data.get('status') not in ['ranked', 'loved', 'qualified', 'approved']:
            return None
        if not any(b.get('mode') == 'osu' for b in data.get('beatmaps', [])):
            return None

        title = data.get('title', 'N/A')
        artist = data.get('artist', 'N/A')
        status = data.get('status', 'N/A').capitalize()
        map_id = data.get('id')
        url = f"https://osu.ppy.sh/beatmapsets/{map_id}"
        thumb = data.get('covers', {}).get('cover@2x') or data.get('covers', {}).get('cover')
        return f"{title} [{artist}] ({status})", url, str(map_id), thumb
    except:
        return None


def get_random_map(token):
    if not token:
        return None

    results = []
    def attempt():
        r = fetch_map_by_id(random.randint(1, 3000000), token)
        if r:
            results.append(r)

    threads = []
    for _ in range(NUM_ATTEMPTS):
        if results:
            break
        t = threading.Thread(target=attempt, daemon=True)
        t.start(); threads.append(t)
    for t in threads:
        t.join(timeout=7)
    return results[0] if results else None


def animate_loading():
    global loading_dots
    if loading_running:
        loading_label.config(text="Searching" + "."*(loading_dots % 4))
        loading_dots += 1
        root.after(500, animate_loading)


def show_random_map():
    global loading_running, loading_dots, current_thumbnail_photo
    loading_dots = 0
    loading_running = True
    button.config(state="disabled")
    copy_link_btn.config(state="disabled")
    copy_id_btn.config(state="disabled")
    result_label.config(text="")
    feedback_label.config(text="")
    thumbnail_label.config(image=None, text="Loading thumbnail...")
    current_thumbnail_photo = None

    animate_loading()
    threading.Thread(target=fetch_and_update_map, daemon=True).start()


def fetch_and_update_map():
    global current_map_id, loading_running
    token = get_osu_token()
    if not token:
        root.after(0, show_error, "Failed to get API token.")
        return

    while loading_running:
        data = get_random_map(token)
        if data:
            title, url, mid, thumb = data
            current_map_id = mid
            img_bytes = None
            if thumb:
                try:
                    ir = requests.get(thumb, timeout=10)
                    ir.raise_for_status()
                    img_bytes = ir.content
                except:
                    pass
            root.after(0, update_interface, title, url, img_bytes)
            return


def show_error(msg):
    global loading_running
    loading_running = False
    loading_label.config(text=msg, fg="orangeRed")
    button.config(state="normal")


def open_map(event=None):
    if current_url:
        webbrowser.open(current_url)


def update_interface(title, url, image_content):
    global current_url, loading_running, current_thumbnail_photo
    loading_running = False
    current_url = url
    loading_label.config(text="")

    if image_content:
        try:
            img = Image.open(io.BytesIO(image_content))
            img.thumbnail((320, 200), Image.Resampling.LANCZOS)
            current_thumbnail_photo = ImageTk.PhotoImage(img)
            thumbnail_label.config(image=current_thumbnail_photo, text="")
        except:
            thumbnail_label.config(text="No thumbnail", fg="#abb2bf")
    else:
        thumbnail_label.config(text="No thumbnail", fg="#abb2bf")

    result_label.config(text=title)

    # Enable buttons
    button.config(state="normal")
    copy_link_btn.config(state="normal")
    copy_id_btn.config(state="normal")

    # Make card clickable
    for widget in (card, thumbnail_label, result_label):
        widget.config(cursor="hand2")
        widget.unbind("<Button-1>")
        widget.bind("<Button-1>", open_map)


def copy_link():
    if current_url:
        root.clipboard_clear(); root.clipboard_append(current_url)
        feedback_label.config(text="Link copied!", fg="#77dd77")
        root.after(2000, lambda: feedback_label.config(text=""))


def copy_id():
    if current_map_id:
        root.clipboard_clear(); root.clipboard_append(current_map_id)
        feedback_label.config(text="ID copied!", fg="#77dd77")
        root.after(2000, lambda: feedback_label.config(text=""))

# === GUI ===
root = tk.Tk()
root.title("osu! Random Beatmap Finder")
root.configure(bg="#282c34")
root.resizable(False, False)

font_style = ("Segoe UI", 11)
title_style = ("Segoe UI Semibold", 12)
btn_style = ("Segoe UI", 12, "bold")

main = tk.Frame(root, bg="#282c34", padx=20, pady=20)
main.pack()

button = tk.Button(main, text="Get Random Beatmap", command=show_random_map,
                   font=btn_style, bg="#61afef", fg="white",
                   relief="flat", activebackground="#5298d1", activeforeground="white")
button.pack(pady=(0,10))

loading_label = tk.Label(main, text="", font=font_style, fg="#abb2bf", bg="#282c34")
loading_label.pack(pady=5)

card = tk.Frame(main, bg="#3a3f4b", bd=2, relief="groove")
card.pack(pady=10)

thumbnail_label = tk.Label(card, bg="#3a3f4b", text="No map loaded", fg="#abb2bf", font=font_style)
thumbnail_label.pack(pady=10)

result_label = tk.Label(card, text="", font=title_style, fg="#e5c07b", bg="#3a3f4b", wraplength=460)
result_label.pack(pady=5)

copy_frame = tk.Frame(main, bg="#282c34")
copy_frame.pack(pady=5)

copy_link_btn = tk.Button(copy_frame, text="Copy Link", command=copy_link,
                           font=("Segoe UI",10), bg="#4b5263", fg="white",
                           relief="flat", activebackground="#5c6370", activeforeground="white", state="disabled")
copy_link_btn.pack(side="left", padx=5)

copy_id_btn = tk.Button(copy_frame, text="Copy ID", command=copy_id,
                         font=("Segoe UI",10), bg="#4b5263", fg="white",
                         relief="flat", activebackground="#5c6370", activeforeground="white", state="disabled")
copy_id_btn.pack(side="left", padx=5)

feedback_label = tk.Label(main, text="", font=font_style, fg="#77dd77", bg="#282c34")
feedback_label.pack(pady=5)

root.mainloop()
