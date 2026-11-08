from flask import Blueprint, render_template, session, redirect, url_for

pages_bp = Blueprint("pages", __name__)

# Where to send a student right after a successful login.
POST_LOGIN_URL = "/index"


def _render_auth_page(initial_tab):
    return render_template(
        "login.html",
        initial_tab=initial_tab,
        has_session=session.get("student_id") is not None,
        post_login_url=POST_LOGIN_URL,
    )


@pages_bp.route("/login")
def login_page():
    return _render_auth_page("login")


@pages_bp.route("/register")
def register_page():
    return _render_auth_page("register")


@pages_bp.route("/index")
def index_page():
    student_id = session.get("student_id")
    if not student_id:
        return redirect(url_for("pages.login_page"))
    return render_template("index.html")
