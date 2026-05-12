package com.synchef.mobile

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import com.synchef.mobile.data.ApiClient
import com.synchef.mobile.data.SessionManager

class HomeActivity : Activity() {

    private lateinit var sessionManager: SessionManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        sessionManager = SessionManager(this)

        if (sessionManager.isLoggedIn()) {
            ApiClient.tokenProvider = { sessionManager.getToken() }
            startActivity(Intent(this, DashboardActivity::class.java))
            finish()
            return
        }

        setContentView(R.layout.activity_home)

        findViewById<TextView>(R.id.tvSignIn).setOnClickListener {
            startActivity(Intent(this, LoginActivity::class.java))
        }

        findViewById<Button>(R.id.btnSignUp).setOnClickListener {
            startActivity(Intent(this, RegisterActivity::class.java))
        }
    }
}
