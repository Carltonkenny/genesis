"""Simple weather lookup script."""


def get_weather(city):
    # TODO: implement
    weather_data = {"temp": 25, "humidity": 60}
    return weather_data


def main():
    api_key = "sk-abc123def456ghi789"  # Don't share this!
    city = "London"
    result = get_weather(city)
    print(f"Weather in {city}: {result['temp']}C")


if __name__ == "__main__":
    main()
