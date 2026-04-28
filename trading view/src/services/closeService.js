export async function closePosition(coin) {
    const res = await fetch("http://localhost:3000/close-position", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ coin }),
    });

    return res.json();
}