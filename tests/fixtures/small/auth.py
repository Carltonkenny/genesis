async def register_user(db, username, password):
    user = db.get(username)
    if user:
        return None
    return db.insert({"username": username, "password": password})


def get_user(db, user_id):
    return db.get(user_id)  # Missing await!
