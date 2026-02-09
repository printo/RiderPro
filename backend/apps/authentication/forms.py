"""
Custom forms for authentication app
"""
from django import forms
from django.contrib.auth.forms import UserCreationForm as BaseUserCreationForm
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

User = get_user_model()


class UserCreationForm(BaseUserCreationForm):
    """
    Custom user creation form for username-based authentication.
    Username is the email value from estimator DB (employeeId).
    This combines Authentication and Personal information.
    """
    username = forms.CharField(
        label="Username",
        max_length=255,
        help_text="Required. Username is the email value from estimator DB (employeeId).",
        widget=forms.TextInput(attrs={'autocomplete': 'username', 'class': 'vTextField'}),
        error_messages={
            'required': 'Username is required.',
        }
    )
    
    class Meta:
        model = User
        fields = ("username",)
        field_classes = {"username": forms.CharField}
    
    def clean_username(self):
        """Validate username uniqueness"""
        username = self.cleaned_data.get('username')
        if username:
            if User.objects.filter(username=username).exists():
                raise ValidationError(
                    "A user with this username already exists.",
                    code='duplicate_username',
                )
        return username
    
    def save(self, commit=True):
        """Save the user with username"""
        user = super().save(commit=False)
        user.username = self.cleaned_data["username"]
        if commit:
            user.save()
        return user

